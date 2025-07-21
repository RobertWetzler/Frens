// Custom JavaScript for Swagger UI to auto-populate auth token in development
(function() {
    // Wait for Swagger UI to load
    function waitForSwaggerUI() {
        if (typeof window.ui !== 'undefined') {
            setupAutoAuth();
        } else {
            setTimeout(waitForSwaggerUI, 100);
        }
    }
    
    function setupAutoAuth() {
        // Add a button to auto-populate the token
        const style = document.createElement('style');
        style.textContent = `
            .auto-auth-btn {
                background: #61affe;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin: 10px;
                font-size: 14px;
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9999;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .auto-auth-btn:hover {
                background: #4e90d9;
            }
        `;
        document.head.appendChild(style);
        
        // Add button to the page
        const addAutoAuthButton = () => {
            if (!document.querySelector('.auto-auth-btn')) {
                const button = document.createElement('button');
                button.className = 'auto-auth-btn';
                button.textContent = 'Auto-Login as Robert';
                button.onclick = autoPopulateToken;
                document.body.appendChild(button);
            }
        };
        
        // Add the button immediately
        addAutoAuthButton();
    }
    
    async function autoPopulateToken() {
        try {
            const response = await fetch('/api/testauth/generate-test-token?email=robert@gmail.com');
            const data = await response.json();
            
            if (data.token) {
                // Use Swagger UI's built-in authorization method
                if (window.ui && window.ui.authActions) {
                    // Method 1: Use Swagger UI's auth actions
                    window.ui.authActions.authorize({
                        Bearer: {
                            name: "Bearer",
                            schema: {
                                type: "http",
                                scheme: "bearer"
                            },
                            value: data.token // Just the token, no "Bearer " prefix
                        }
                    });
                    console.log('Auto-populated token using Swagger UI auth actions');
                } else if (window.ui && window.ui.preauthorizeApiKey) {
                    // Method 2: Use preauthorizeApiKey
                    window.ui.preauthorizeApiKey("Bearer", data.token);
                    console.log('Auto-populated token using preauthorizeApiKey');
                } else {
                    // Method 3: Manual DOM manipulation as fallback
                    // First, try to open the authorize dialog
                    const authorizeBtn = document.querySelector('.btn.authorize');
                    if (authorizeBtn) {
                        authorizeBtn.click();
                        
                        // Wait for dialog to open, then populate the token
                        setTimeout(() => {
                            const tokenInput = document.querySelector('input[placeholder="Value"]') || 
                                             document.querySelector('.auth-container input[type="text"]') ||
                                             document.querySelector('section input[type="text"]');
                            
                            if (tokenInput) {
                                tokenInput.value = data.token; // Just the token, no "Bearer " prefix
                                tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
                                
                                // Try to click the authorize button in the dialog
                                setTimeout(() => {
                                    const authorizeDialogBtn = document.querySelector('.btn.modal-btn.auth.authorize');
                                    if (authorizeDialogBtn) {
                                        authorizeDialogBtn.click();
                                    }
                                }, 100);
                                
                                console.log('Auto-populated token using DOM manipulation');
                            } else {
                                throw new Error('Could not find token input field');
                            }
                        }, 300);
                    } else {
                        throw new Error('Could not find authorize button');
                    }
                }
                
                alert(`Auto-logged in as ${data.user.name}! Token has been applied.`);
            } else {
                throw new Error('No token received from server');
            }
        } catch (error) {
            console.error('Failed to auto-populate token:', error);
            alert(`Failed to auto-populate token: ${error.message}. Please try manually.`);
        }
    }
    
    // Start the setup process
    waitForSwaggerUI();
})();
