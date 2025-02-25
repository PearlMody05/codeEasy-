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
        const structuredPrompt = this.generatecodePromptt(prompt, context);
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
            const fname = jsonResponse.fileName || null;
            const code= this.formatResponse(jsonResponse.code);
            
            if (requird==="YES"){
                if(fname){
                    await createFile(fname,null,code)
                }
            }
            return code;
           
        } catch (error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }

    generatecodePromptt(userPrompt, context) {
        return `
        You are an expert programmer. Generate code based on the following:
        
        Context:
        - Programming Language: ${context.language}
        - File Type: ${context.fileType}
        - Current File Content: ${context.currentFileContent || 'None'}
        
        User Request: ${userPrompt}
        
        Respond with a JSON object containing the following(STRICTLY JSON):
        1. "file_required": "YES" if a new file is needed, otherwise "NO".
        2. "fileName": The name of the new file if "file_required" is "YES". Omit this field if "file_required" is "NO".
        3. "code": The generated code implementation.
        
        Requirements:
        1. Generate only the code implementation
        2. Ensure the code follows best practices
        3. Include necessary imports/requires
        4. Make the code production-ready
        5. Only return the JSON object, no explanations or comments
        6.Do **not** include any text outside of the JSON response.
        Be very sure and only Generate the strictly JSON response now:`;
    }
    formatResponse(text) {
        // Clean up the response to extract only the code
        // Remove any markdown code block syntax if present
        return text.replace(/```[\w]*\n?/, '').replace(/```$/, '').trim();
    }
    editorPrompt(userPrompt, context) {
        // Define the schema for the expected response format
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
    
            const correctCode = this.formatResponse(jsonResponse.correct_code);
            const explanation = jsonResponse.explanation;
    
            return { correct_code: correctCode, explanation: explanation };
        } catch (error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }
    

    
}

module.exports = GeminiService;