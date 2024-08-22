// chatManager.test.js

import { addMessageToChat, initializeChat, loadChatHistory, sendMessage } from './chatManager';
import { addDebugMessage } from './utils';

jest.mock('./utils', () => ({
    addDebugMessage: jest.fn(),
    addMessageToChat: jest.fn()
}));

describe('Chat Manager Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `<div id="chatWindow"></div>`;
        window.currentConversationId = null; // Reset before each test
    });

    it('should add a message to chat', () => {
        const sender = 'User';
        const message = 'Hello!';
        
        addMessageToChat(sender, message);
        
        expect(addMessageToChat).toHaveBeenCalledWith(sender, expect.any(String));
    });

    it('should initialize chat successfully', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({ success: true, conversationId: '123' })
        });

        await initializeChat();

        expect(addMessageToChat).toHaveBeenCalledWith('System', 'Chat initialized');
    });

    it('should handle errors during chat initialization', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

        await initializeChat();

        expect(addDebugMessage).toHaveBeenCalledWith("There was an error initializing the chat. Please try again.");
    });

    it('should load chat history successfully', async () => {
        // Mocking currentConversationId
        window.currentConversationId = '123';

        // Mocking fetch to simulate API response
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                retcode: 0,
                data: { message: [{ role: 'user', content: 'Hello!' }] }
            })
        });

        await loadChatHistory();

        expect(addMessageToChat).toHaveBeenCalledWith('User', 'Hello!');
        expect(addDebugMessage).toHaveBeenCalledWith('Chat history loaded successfully.');
    });

    it('should handle errors when loading chat history', async () => {
        window.currentConversationId = '123';
        
        global.fetch = jest.fn().mockRejectedValue(new Error("Fetch error"));

        await loadChatHistory();

        expect(addDebugMessage).toHaveBeenCalledWith("There was an error loading the chat history.");
    });

    it('should send a message successfully', async () => {
       const question = "What is WebXR?";
       window.currentConversationId = "123";
       
       global.fetch = jest.fn()
           .mockResolvedValueOnce({ json: jest.fn().mockResolvedValue({ success: true }) }) // For init
           .mockResolvedValueOnce({ json: jest.fn().mockResolvedValue({ retcode: 0, data: { answer: "It's great!" } }) }); // For sending message

       await sendMessage(question);

       expect(addMessageToChat).toHaveBeenCalledWith('AI', "It's great!");
   });
});
