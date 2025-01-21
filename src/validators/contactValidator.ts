interface ContactForm {
    name: string;
    email: string;
    message: string;
  }
  
  export const validateContactForm = (data: ContactForm): string | null => {
    if (!data.name || data.name.trim().length < 2) {
      return 'Name must be at least 2 characters long';
    }
  
    if (!data.email || !isValidEmail(data.email)) {
      return 'Please provide a valid email address';
    }
  
    if (!data.message || data.message.trim().length < 10) {
      return 'Message must be at least 10 characters long';
    }
  
    return null;
  };
  
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  