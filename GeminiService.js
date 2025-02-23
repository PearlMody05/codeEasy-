// @ts-nocheck

const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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

    async generateCode(prompt, context) {
        try {
            const structuredPrompt = this.constructPrompt(prompt, context);

            // Generate content using Gemini
            const result = await this.model.generateContent(structuredPrompt);
            const response = await result.response;
            const text = response.text();

            // Extract code from response
            return this.formatResponse(text);
        } catch (error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }

    constructPrompt(userPrompt, context) {
        return `
        You are an expert programmer. Generate code based on the following:
        
        Context:
        - Programming Language: ${context.language}
        - File Type: ${context.fileType}
        - Current File Content: ${context.currentFileContent || 'None'}
        
        User Request: ${userPrompt}
        
        Requirements:
        1. Generate only the code implementation
        2. Ensure the code follows best practices
        3. Include necessary imports/requires
        4. Make the code production-ready
        5. Only return the code, no explanations or comments
        
        Generate the code now:`;
    }

    formatResponse(text) {
        // Clean up the response to extract only the code
        // Remove any markdown code block syntax if present
        return text.replace(/```[\w]*\n?/, '').replace(/```$/, '').trim();
    }
}

module.exports = GeminiService;