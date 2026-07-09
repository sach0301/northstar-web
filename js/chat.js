import { STATE } from './state.js';
import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatInputForm = document.getElementById('chat-input-form');
  const chatTextInput = document.getElementById('chat-text-input');
  const btnClearChat = document.getElementById('btn-clear-chat');
  const suggestionChips = document.querySelectorAll('.suggestion-chip');

  // Initialize Chat Flow
  initializeChat();

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
    STATE.chatHistory = [];
    STATE.chatSessionId = null;
    STATE.saveToSession();
    
    // Clear display, run initial context summarization again
    chatMessagesContainer.innerHTML = '';
    initializeChat();
  });

  async function initializeChat() {
    // 1. Check if history exists
    if (STATE.chatHistory.length > 0) {
      STATE.chatHistory.forEach(msg => {
        appendMessage(msg.role, msg.content);
      });
      return;
    }

    // 2. Check if analysis data is present to run initial context sync
    if (STATE.analysisResult) {
      // Append initial greeting
      appendMessage('assistant', "Analyzing your synced business metrics... I am initializing a strategic consultant session for you.");
      
      const typingIndicator = showTypingIndicator();
      try {
        const initialPrompt = "Please summarise the most critical insights and top 3 actions I should take.";
        const botResponse = await API.sendChatMessage(initialPrompt);
        
        typingIndicator.remove();
        appendMessage('assistant', botResponse.content);
      } catch (err) {
        typingIndicator.remove();
        appendMessage('assistant', `Failed to initialize AI consultant session: ${err.message}. Ask a free-form question below to retry.`);
      }
    } else {
      // Show default greeting if no data uploaded yet
      appendMessage('assistant', "Hello! I am your Northstar AI Business Co-pilot. Please upload your spreadsheet on the Upload page and run the analysis to unlock context-aware consulting.");
    }
  }

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

  function parseMarkdown(text) {
    let html = text;
    // Replace Markdown headings (###, ##, #)
    html = html.replace(/^### (.*?)$/gm, '<h4 style="font-size:1.15rem; margin-top:12px; margin-bottom:6px; color:var(--accent-light); font-weight:600;">$1</h4>');
    html = html.replace(/^## (.*?)$/gm, '<h3 style="font-size:1.25rem; margin-top:16px; margin-bottom:8px; color:var(--text-primary); font-weight:600;">$1</h3>');
    html = html.replace(/^# (.*?)$/gm, '<h2 style="font-size:1.4rem; margin-top:20px; margin-bottom:10px; color:var(--text-primary); font-weight:700;">$1</h2>');
    
    // Bold markdown (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet lists (* text or - text)
    html = html.replace(/^\* (.*?)$/gm, '<li style="margin-left:18px; margin-bottom:6px; list-style-type: disc;">$1</li>');
    html = html.replace(/^- (.*?)$/gm, '<li style="margin-left:18px; margin-bottom:6px; list-style-type: disc;">$1</li>');
    
    // Linebreaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'bot'}`;

    const isUser = role === 'user';
    const avatarIcon = isUser ? 'user' : 'bot';
    
    // Parse Markdown format into HTML
    const bubbleInner = isUser ? content : parseMarkdown(content);

    msgDiv.innerHTML = `
      <div class="chat-avatar">
        <i data-lucide="${avatarIcon}" style="width: 18px; height: 18px; ${!isUser ? 'color: var(--accent-light);' : ''}"></i>
      </div>
      <div class="chat-bubble">
        <div class="chat-bubble-text">${bubbleInner}</div>
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
