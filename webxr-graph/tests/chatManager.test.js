// chatManager.test.js

import { addMessageToChat, addDebugMessage, initializeChat, loadChatHistory, sendMessage, setupChatEventListeners } from '../public/js/chatManager';
import { updateStatus } from '../public/js/utils';

jest.mock('../public/js/utils', () => ({
    updateStatus: jest.fn(),
}));

describe('Chat Manager Functions', () => {
    let mockFetch;

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <div id="chatWindow"></div>
            <input id="questionInput" />
            <button id="askButton"></button>
        `;
        global.currentConversationId = null;
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        global.marked = { parse: jest.fn(text => text) };
    });

    afterEach(() => {
        delete global.fetch;
        delete global.marked;
    });

    test('addMessageToChat adds a message to the chat window', () => {
        const sender = 'User';
        const message = 'Hello!';
        
        addMessageToChat(sender, message);
        
        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain(sender);
        expect(chatWindow.innerHTML).toContain(message);
    });

    test('addDebugMessage adds a debug message to the chat', () => {
        const message = 'Debug message';
        
        addDebugMessage(message);
        
        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain('Debug');
        expect(chatWindow.innerHTML).toContain(message);
    });

    test('initializeChat initializes chat successfully', async () => {
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ success: true, conversationId: '123' })
        });

        await initializeChat();

        expect(mockFetch).toHaveBeenCalledWith('/api/chat/init', expect.any(Object));
        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain('Chat initialized');
    });

    test('loadChatHistory loads chat history successfully', async () => {
        global.currentConversationId = '123';
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({
                retcode: 0,
                data: { message: [{ role: 'user', content: 'Hello!' }] }
            })
        });

        await loadChatHistory();

        expect(mockFetch).toHaveBeenCalledWith('/api/chat/history/123');
        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain('Hello!');
    });

    test('sendMessage sends a message successfully', async () => {
        global.currentConversationId = '123';
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ retcode: 0, data: { answer: "It's great!" } })
        });

        await sendMessage('What is WebXR?');

        expect(mockFetch).toHaveBeenCalledWith('/api/chat/message', expect.any(Object));
        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain("It's great!");
    });

    test('setupChatEventListeners sets up event listeners correctly', () => {
        const addEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener');
        
        setupChatEventListeners();

        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('keypress', expect.any(Function));
    });

    test('sendMessage handles empty input', async () => {
        await sendMessage('   ');

        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain('Please enter a question!');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('initializeChat handles error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await initializeChat();

        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain('There was an error initializing the chat. Please try again.');
    });

    test('loadChatHistory handles missing conversation ID', async () => {
        global.currentConversationId = null;

        await loadChatHistory();

        const chatWindow = document.getElementById('chatWindow');
        expect(chatWindow.innerHTML).toContain('No active conversation to load history from.');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
