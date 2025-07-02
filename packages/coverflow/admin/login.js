// Check if already authenticated
(async function checkExistingAuth() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      // Already logged in, redirect appropriately based on domain
      if (window.location.hostname.startsWith('admin.')) {
        // On admin subdomain, go to root
        window.location.href = '/';
      } else {
        // On main domain, go to admin directory
        window.location.href = '/admin/';
      }
    }
  } catch (err) {
    // Not logged in, stay on login page
  }
})();

// Toggle password visibility
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    `;
  } else {
    passwordInput.type = 'password';
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    `;
  }
}

// Show error message
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.classList.add('show');
  
  // Hide after 5 seconds
  setTimeout(() => {
    errorEl.classList.remove('show');
  }, 5000);
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const loginBtn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('errorMessage');
  
  // Get form data
  const formData = new FormData(e.target);
  const credentials = {
    username: formData.get('username'),
    password: formData.get('password')
  };
  
  // Show loading state
  loginBtn.disabled = true;
  loginBtn.classList.add('loading');
  errorEl.classList.remove('show');
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    // Success - store remember me preference
    if (formData.get('remember')) {
      localStorage.setItem('rememberUsername', credentials.username);
    } else {
      localStorage.removeItem('rememberUsername');
    }
    
    // Redirect to dashboard based on domain
    if (window.location.hostname.startsWith('admin.')) {
      // On admin subdomain, go to root
      window.location.href = '/';
    } else {
      // On main domain, go to admin directory
      window.location.href = '/admin/';
    }
    
  } catch (error) {
    showError(error.message || 'Invalid username or password');
    
    // Shake the form
    const container = document.querySelector('.login-container');
    container.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      container.style.animation = '';
    }, 500);
    
  } finally {
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
  }
});

// Load remembered username
window.addEventListener('DOMContentLoaded', () => {
  const rememberedUsername = localStorage.getItem('rememberUsername');
  if (rememberedUsername) {
    document.getElementById('username').value = rememberedUsername;
    document.getElementById('remember').checked = true;
    document.getElementById('password').focus();
  } else {
    document.getElementById('username').focus();
  }
});

// Handle enter key in username field
document.getElementById('username').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('password').focus();
  }
});

// Add visual feedback for form inputs
document.querySelectorAll('input[type="text"], input[type="password"]').forEach(input => {
  input.addEventListener('focus', () => {
    input.parentElement.classList.add('focused');
  });
  
  input.addEventListener('blur', () => {
    input.parentElement.classList.remove('focused');
  });
});

// Prevent form resubmission on page refresh
if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}