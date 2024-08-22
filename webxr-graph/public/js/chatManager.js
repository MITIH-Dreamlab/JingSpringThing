import { updateStatus } from './utils.js';

let currentConversationId = null;

export function addMessageToChat(sender, message) {
    const chatWindow = document.getElementById('chatWindow');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `<strong>${sender}:</strong> ${window.marked.parse(message)}`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

export function addDebugMessage(message) {
    addMessageToChat('Debug', message);
}

export async function initializeChat() {
    try {
        const response = await fetch('/api/chat/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: 'webxr-user' }),
        });
        const data = await response.json();
        if (data.success) {
            currentConversationId = data.conversationId;
            addMessageToChat('System', 'Chat initialized');
        } else {
            throw new Error(data.error || 'Failed to initialize chat');
        }
    } catch (error) {
        console.error("Error initializing chat:", error);
        addMessageToChat('System', "There was an error initializing the chat. Please try again.");
    }
}

export async function loadChatHistory() {
    if (!currentConversationId) {
        addDebugMessage('No active conversation to load history from.');
        return;
    }

    try {
        const response = await fetch(`/api/chat/history/${currentConversationId}`);
        const data = await response.json();

        if (data.retcode === 0) {
            const chatWindow = document.getElementById('chatWindow');
            chatWindow.innerHTML = ''; // Clear existing messages
            data.data.message.forEach(msg => {
                addMessageToChat(msg.role === 'user' ? 'User' : 'AI', msg.content);
            });
            addDebugMessage('Chat history loaded successfully.');
        } else {
            throw new Error('Failed to load chat history');
        }
    } catch (error) {
        console.error("Error loading chat history:", error);
        addMessageToChat('System', "There was an error loading the chat history.");
    }
}

export async function sendMessage(question) {
    if (!question.trim()) {
        addMessageToChat('System', "Please enter a question!");
        return;
    }

    addMessageToChat('User', question);

    try {
        if (!currentConversationId) {
            await initializeChat();
        }

        const response = await fetch('/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                conversationId: currentConversationId,
                message: question 
            }),
        });
        const data = await response.json();

        if (data.retcode === 0) {
            addMessageToChat('AI', data.data.answer);
        } else {
            throw new Error('Failed to get answer');
        }
    } catch (error) {
        console.error("Error asking question:", error);
        addMessageToChat('System', "There was an error processing your question. Please try again.");
    }
}

export function setupChatEventListeners() {
    const questionInput = document.getElementById('questionInput');
    const askButton = document.getElementById('askButton');

    askButton.addEventListener('click', () => {
        const question = questionInput.value;
        sendMessage(question);
        questionInput.value = ''; // Clear input after sending
    });

    questionInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            askButton.click();
        }
    });

    addDebugMessage('Chat event listeners set up.');
}
