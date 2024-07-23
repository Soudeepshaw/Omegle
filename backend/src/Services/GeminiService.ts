import { GoogleGenerativeAI ,ChatSession} from '@google/generative-ai';

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private chatSessions: Map<string, ChatSession>;

    constructor() {
        console.log('Initializing GeminiService');
        this.genAI = new GoogleGenerativeAI("AIzaSyCEItIAVCnm56UPvk4Vm9cvqg3RAa4GfSg");
        this.chatSessions = new Map();
    }

    async askQuestion(userId: string,question: string): Promise<string> 
    {console.log(`Received question for Gemini: "${question}"`);
        try {
            
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            let chat = this.chatSessions.get(userId);
            if (!chat) {
                chat = model.startChat({
                    generationConfig: {
                        maxOutputTokens: 100,
                    },
                });
                this.chatSessions.set(userId, chat);
            }
            
            const result = await chat.sendMessage(question);
            console.log('Processing response...');
            const response = await result.response;
            const answer = response.text();
            console.log(`Gemini response for user ${userId}: "${answer}"`);
            return answer;
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            return "Sorry, I couldn't process your request at the moment.";
        }
    }
    clearChatHistory(userId: string) {
        this.chatSessions.delete(userId);
    }
}
