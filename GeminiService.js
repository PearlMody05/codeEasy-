// @ts-nocheck

const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const createFile = require('./createFile')

const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else {
    console.log('.env file not found at:', envPath);
}


class GeminiService {
    
    constructor() {
        const apiKey =process.env.GEMINI_API_KEY; 
        if (!apiKey) {
            throw new Error("Missing API Key");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });
    }
    
     async chatGemini(prompt,context,structuredPrompt){
        const result = await this.model.generateContent(structuredPrompt);
        const response = await result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json\n?|```/g, "").trim(); // Remove markdown code blocks
        return cleanedText;
    }


    async generateCode(prompt, context) {
        const structuredPrompt = this.generateCodePrompt(prompt, context);
        try {
           let cleanedText= await this.chatGemini(prompt,context,structuredPrompt)
            // Parse the JSON response
            let jsonResponse;
            try {
                jsonResponse = JSON.parse(cleanedText);
                } 
            catch (jsonError) {
                    throw new Error(`Gemini API returned invalid JSON: ${jsonError.message}`);
                }
            
            jsonResponse = JSON.parse(cleanedText);
            const requird = jsonResponse.file_required;
            const fnames = jsonResponse.fileNames ;
            const codes= jsonResponse.codes;
            const n = jsonResponse.numFiles;
            if (requird==="YES"){
                for(let i =0; i<n; i++)
                {
                    await createFile(fnames[i],null,codes[i])
                }
            }
            return codes[0];
           
        } catch (error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }
    generateCodePrompt(userPrompt, context) {
        // Validating the context
        if (!context || !context.language || !context.fileType) {
            throw new Error("Invalid context: 'language' and 'fileType' are required.");
        }
    
        // Define schema
        const gencodeSchema = {
            type: "object",
            properties: {
                file_required: {
                    type: "string",
                    enum: ["YES", "NO"],
                    description: '"YES" if a new file is needed, otherwise "NO"',
                },
                fileNames: {
                    type: "array",
                    description: 'The name of the new file if "file_required" is "YES". Omit this field if "file_required" is "NO".',
                    items: {
                        type: "string",
                    },
                },
                numFiles: {
                    type: "integer",
                    default: 0,
                    description: 'The number of new files required to be created . if "file_required" is "YES". Omit this field if "file_required" is "NO".',
                },
                codes: {
                    type: "array",
                    description: "List of required code snippets. If numFiles is more than 1, each file's code should be in a separate array entry, in the order of the files.",
                    items: {
                        type: "string",
                    },
                    minItems: 1,
                },
            },
            required: ["file_required", "codes"],
            if: {
                properties: {
                    file_required: { const: "YES" },
                },
            },
            then: {
                required: ["fileNames", "numFiles"],
            },
        };
    
        // Convert schema to JSON string
        const schema = JSON.stringify(gencodeSchema, null, 2);
    
        // Generate prompt
        return `
        You are an expert programmer. Generate code based on the following:
    
        === CONTEXT ===
        - Programming Language: ${context.language}
        - File Type: ${context.fileType}
        - Current File Content: ${context.currentFileContent || 'None'}
    
        === USER REQUEST ===
        ${userPrompt}
    
        === RESPONSE FORMAT ===
        Respond with a JSON object containing the following (STRICTLY JSON):
        \`\`\`json
        ${schema}
        \`\`\`
    
        === REQUIREMENTS ===
        1. Generate only the code implementation.
        2.Figure out the number of files needed based on number of files to be created, as mentioned by the user
        3.when creating new file: If the file name is not specified by the user, name the file with the most sutiable name based on functionality
        4. Ensure the code follows best practices.
        5. Include necessary imports/requires.
        6. Make the code production-ready.
        7. Only return the JSON object—no explanations or comments.
        8. Do **not** include any text outside of the JSON response.
        9. file_required is **"YES"** only when the user mentions to create a file
    
        Be very sure and only generate the strictly JSON response now:
        `;
    }
    

    editorPrompt(userPrompt, context) {
        //schema for the expected response format
        const schema = {
          type: "object",
          properties: {
            correct_code: {
              type: "string",
              description: "Updated and correct version of the code",
            },
            explanation: {
              type: "array",
              description: "List of improvements made",
              items: {
                type: "string",
              },
            },
          },
          required: ["correct_code", "explanation"],
        };
      
        // Convert schema to a JSON Schema format string for the prompt
        const schemaString = JSON.stringify(schema, null, 2);
      
        // Construct the prompt template
        return `
      You are an **expert software engineer and code reviewer**. Your task is to analyze the given code and improve it **strictly based on the user's request**.
      
      ### **Context:**
      - **Programming Language:** ${context.language}
      - **File Type:** ${context.fileType}
      - **Current Code:**
      \`\`\`${context.language}
      ${context.currentFileContent || 'None'}
      \`\`\`
      
      ### **User Request:**
      \`\`\`
      ${userPrompt}
      \`\`\`
      
      ### **Response Schema:**
      Your response must strictly conform to this JSON schema:
      
      \`\`\`json
      ${schemaString}
      \`\`\`
      
      ### **Instructions:**
      - **If the code has errors**, fix them to ensure it runs correctly.
      - **If the code is inefficient**, refactor it while keeping functionality unchanged.
      - **Only modify what is necessary** based on the user request.
      - **DO NOT** include any explanations, greetings, or extra text outside of JSON format.
      
      ### **Example Response Format:**
      \`\`\`json
      {
        "correct_code": "function example() { return 'fixed code'; }",
        "explanation": [
          "Fixed syntax error in function declaration",
          "Improved return statement formatting",
          "Added missing semicolon"
        ]
      }
      \`\`\`
      
      ### **Important Rules:**
      1. **Strictly return valid JSON** matching the provided schema.
      2. **No additional text, comments, or greetings.**
      3. If no changes are needed, return the original code inside \`correct_code\` and explain why.
      
      Now, **ONLY** return the JSON object, without extra text or formatting.
      `;
      }
    async editCode(prompt, context) {
        const structuredPrompt = this.editorPrompt(prompt, context);
        try {
            let cleanedText = await this.chatGemini(prompt, context, structuredPrompt);
    
            // Parse the JSON response safely
            let jsonResponse;
            try {
                jsonResponse = JSON.parse(cleanedText);
            } catch (jsonError) {
                throw new Error(`Gemini API returned invalid JSON: ${jsonError.message}`);
            }
    
            // Ensure required fields exist
            if (!jsonResponse.correct_code || !jsonResponse.explanation) {
                throw new Error("Gemini API response is missing required fields (correct_code or explanation).");
            }
    
            const correctCode = jsonResponse.correct_code;
            const explanation = jsonResponse.explanation;
    
            return { correct_code: correctCode, explanation: explanation };
        } catch (error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }


    testCodePrompt(userPrompt, context) {
        // Validating the context
        if (!context || !context.language || !context.fileType) {
            throw new Error("Invalid context: 'language' and 'fileType' are required.");
        }
    
        // Define schema
        const testcodeSchema = {
            type: "object",
            properties: {
                fileName: {
                    type: "string",
                    description: "name the file as per functionality it is testing and specify its a test file",
                },
                importsRqd: {
                    type: "string",
                    description: "Required imports for the test cases (e.g., pytest, modules to test).",
                },
                testCases: {
                    type: "string",
                    description: "Clear, well-structured, and accurate test cases based on pytest for the given user prompt.",
                },
                expectedOutputs: {
                    type: "string",
                    description: "Expected outputs or assertions for the test cases.",
                },
            },
            required: ["fileName", "importsRqd", "testCases", "expectedOutputs"]
        };
    
        // Convert schema to JSON string
        const schema = JSON.stringify(testcodeSchema, null, 2);
    
        // Generate prompt
        return `
        You are an expert software developer. Generate pytest-based test cases based on the following:
    
        === CONTEXT ===
        - Programming Language: ${context.language}
        - File Type: ${context.fileType}
        - Current File Content: ${context.currentFileContent || 'None'}
    
        === USER REQUEST ===
        ${userPrompt}
    
        === RESPONSE FORMAT ===
        Respond with a JSON object containing the following (STRICTLY JSON):
        \`\`\`json
        ${schema}
        \`\`\`
        === REQUIREMENTS ===
        1. The test cases must be accurate and based strictly on the user prompt.
        2. Include all necessary imports (e.g., pytest, modules to test).
        3. Write clear and descriptive test cases with proper assertions.
        4. Ensure the test cases are production-ready and follow best practices.
        5. Only return the JSON object—no explanations or comments.
    
        Be very sure and only generate the strictly JSON response now:
        `;
    }
    async testCode(prompt, context) {
        const structuredPrompt = this.testCodePrompt(prompt, context);
        try {
            let cleanedText = await this.chatGemini(prompt, context, structuredPrompt);
    
            // Parse the JSON response safely
            let jsonResponse;
            try {
                jsonResponse = JSON.parse(cleanedText);
            } catch (jsonError) {
                throw new Error(`Gemini API returned invalid JSON: ${jsonError.message}`);
            }
            console.log("json: ",jsonResponse);
            const importsRqd = jsonResponse.importsRqd;
            const  testCases= jsonResponse.testCases;
            const  fileName= jsonResponse.fileName;
            //const expectedOutputs = jsonResponse.expectedOutputs;
            console.log("testCases",testCases);
            if(!testCases){
                return 0;
            }
            const startImport = `import sys
import os

# Get the parent directory of the current file
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Add parent directory to sys.path
sys.path.append(parent_dir)`;
            const filecontent = startImport+"\n"+importsRqd +"\n"+testCases;
            await createFile(fileName,"test",filecontent);
            console.log("file created")
    
            return 1;
        } catch (error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }
    

    
}

module.exports = GeminiService;