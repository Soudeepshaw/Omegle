import { User } from "./UserManger";
import { GeminiService } from '../Services/GeminiService';

let GLOBAL_ROOM_ID = 1;

interface Room {
    user1: User;
    user2: User;
    messages: { sender: string, content: string }[];
}

export class RoomManager {
    private rooms: Map<string, Room>;
    private geminiService: GeminiService;
    

    constructor() {
        this.rooms = new Map<string, Room>();
        this.geminiService = new GeminiService();
    }

    createRoom(user1: User, user2: User) {
        const roomId = this.generate().toString();
        this.rooms.set(roomId, { user1, user2, messages: [] });
        user1.socket.emit("send-offer", { roomId });
        user2.socket.emit("send-offer", { roomId });
    }

    onOffer(roomId: string, sdp: string, senderSocketid: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2 : room.user1;
        receivingUser?.socket.emit("offer", { sdp, roomId });
    }

    onAnswer(roomId: string, sdp: string, senderSocketid: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2 : room.user1;
        receivingUser?.socket.emit("answer", { sdp, roomId });
    }

    onIceCandidates(roomId: string, senderSocketid: string, candidate: any, type: "sender" | "receiver") {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2 : room.user1;
        receivingUser.socket.emit("add-ice-candidate", { candidate, type });
    }

    findRoomByUser(socketId: string): string | null {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.user1.socket.id === socketId || room.user2.socket.id === socketId) {
                return roomId;
            }
        }
        return null;
    }

    removeRoom(roomId: string): [string, string] {
        const room = this.rooms.get(roomId);
        if (!room) return ['', ''];

        this.rooms.delete(roomId);

        room.user1.socket.emit("lobby");
        room.user2.socket.emit("lobby");

        return [room.user1.socket.id, room.user2.socket.id];
    }
    async handleGeminiRequest(roomId: string, question: string, socketId: string) {
        console.log(`Received Gemini request for room ${roomId}: "${question}"`);
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Room ${roomId} not found for Gemini request`);
            return};
        console.log('Sending question to Gemini service...');
        const answer = await this.geminiService.askQuestion(socketId,question);
        const formattedAnswer = this.formatGeminiResponse(answer);
        console.log('Received formatted answer from Gemini:', formattedAnswer);
    console.log('Emitting Gemini response to the user who asked', socketId);
        const askingUser = room.user1.socket.id === socketId ? room.user1 : room.user2;
        askingUser.socket.emit("gemini-response", { question,  answer:formattedAnswer, forSocketId: socketId });
    }
    private formatGeminiResponse = (text: string) => {
        // Remove asterisks
        let formatted = text.replace(/\*/g, '');
        
        // Convert Markdown-style links to HTML
        formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Convert numbered lists
        formatted = formatted.replace(/(\d+)\.\s/g, '<br><strong>$1.</strong> ');
        
        // Add line breaks for readability
        formatted = formatted.replace(/\n/g, '<br>');
      
        return formatted;
      };
    sendMessage(roomId: string, senderSocketId: string, content: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
    
        const sender = room.user1.socket.id === senderSocketId ? room.user1 : room.user2;
        const receiver = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
    
        const message = { sender: sender.name, content };
        room.messages.push(message);
    
        
        receiver.socket.emit("new-message", message);
    }
    screenShareStarted(roomId: string, socketId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            const otherUser = room.user1.socket.id === socketId ? room.user2 : room.user1;
            otherUser.socket.emit("remote-screen-share-started");
        }
    }
    
    screenShareStopped(roomId: string, socketId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            const otherUser = room.user1.socket.id === socketId ? room.user2 : room.user1;
            otherUser.socket.emit("remote-screen-share-stopped");
        }
    }
    
    generate() {
        return GLOBAL_ROOM_ID++;
    }
}
