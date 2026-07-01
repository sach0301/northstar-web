import { STATE } from './state.js';
import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatInputForm = document.getElementById('chat-input-form');
  const chatTextInput = document.getElementById('chat-text-input');
  const btnClearChat = document.getElementById('btn-clear-chat');
  const suggestionChips = document.querySelectorAll('.suggestion-chip');

  // Load chat history if available
  if (STATE.chatHistory.length > 0) {
    STATE.chatHistory.forEach(msg => {
      appendMessage(msg.role, msg.content);
    });
  }

  // Handle form send
  chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatTextInput.value.trim();
    if (text) {
      sendMessage(text);
    }
  });

  // Handle suggestion chips click
  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.textContent);
    });
  });

  // Handle clear chat history click
  btnClearChat.addEventListener('click', () => {
    STATE.clearSession();
    // Keep only the initial bot welcome message
    chatMessagesContainer.innerHTML = `
      <div class="chat-msg chat-msg-bot">
        <div class="chat-avatar">
          <i data-lucide="bot" style="width: 18px; height: 18px; color: var(--accent-light);"></i>
        </div>
        <div class="chat-bubble">
          Hello! I am your Northstar AI Business Co-pilot. Ask me anything about your product sales, forecasting projections, or expense scheduling. 
        </div>
      </div>
    `;
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  async function sendMessage(text) {
    chatTextInput.value = '';
    
    // 1. Render User Bubble
    appendMessage('user', text);

    // 2. Render typing indicator
    const typingIndicator = showTypingIndicator();

    try {
      // 3. Make API call
      const botResponse = await API.sendChatMessage(text);
      
      // 4. Remove typing indicator, render Bot Bubble
      typingIndicator.remove();
      appendMessage('assistant', botResponse.content);
      
    } catch (err) {
      typingIndicator.remove();
      appendMessage('assistant', `Error getting response: ${err.message}`);
    }
  }

  function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'bot'}`;

    const isUser = role === 'user';
    const avatarIcon = isUser ? 'user' : 'bot';
    
    let bubbleInner = content;
    
    // Basic formatting (convert bold markdown **text** to <strong>)
    bubbleInner = bubbleInner.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    msgDiv.innerHTML = `
      <div class="chat-avatar">
        <i data-lucide="${avatarIcon}" style="width: 18px; height: 18px; ${!isUser ? 'color: var(--accent-light);' : ''}"></i>
      </div>
      <div class="chat-bubble">
        ${bubbleInner}
        ${!isUser ? `
          <div class="chat-bubble-copy">
            <i data-lucide="copy" style="width:12px; height:12px;"></i>
            <span>Copy response</span>
          </div>
        ` : ''}
      </div>
    `;

    chatMessagesContainer.appendChild(msgDiv);
    
    // Add copy clipboard event listener
    if (!isUser) {
      const copyBtn = msgDiv.querySelector('.chat-bubble-copy');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          copyBtn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.querySelector('span').textContent = 'Copy response';
          }, 1500);
        });
      });
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Scroll container to bottom
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function showTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg chat-msg-bot';
    msgDiv.innerHTML = `
      <div class="chat-avatar">
        <i data-lucide="bot" style="width: 18px; height: 18px; color: var(--accent-light);"></i>
      </div>
      <div class="chat-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    chatMessagesContainer.appendChild(msgDiv);
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    return msgDiv;
  }
});
