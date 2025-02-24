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
        return `
        You are an expert software engineer and code reviewer. Your job is to analyze the given code, identify errors (if any), and improve its quality based on the user’s request.
    
        ### Context:
        - **Programming Language:** ${context.language}
        - **File Type:** ${context.fileType}
        - **Current File Content:** ${context.currentFileContent || 'None'}
    
        ### User Request:
        - ${userPrompt}
    
        ### Instructions:
        - Analyze the provided code for **errors, inefficiencies, or areas of improvement**.
        - If the code has errors, **fix them** and ensure it runs correctly.
        - If the code is correct but can be improved, **refactor it** for better readability and efficiency.
        - Maintain the **original functionality** while making improvements.
    
        ### Output Format (Strict JSON):
        {
          "correct_code": "Updated and correct version of the code.",
          "explanation": [
            "Bullet-point explanation of the changes made.",
            "Mention if errors were fixed or improvements were made.",
            "Explain why changes were necessary."
          ]
        }
    
        **Rules:**
        1. Keep the explanations concise, **formatted as bullet points**.
        2. Do **not** change the core logic unless explicitly requested.
        3. Do **not** include any text outside of the JSON response.
    
        Now, strictly generate the JSON response as per the format above.
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