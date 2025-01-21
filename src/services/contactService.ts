// src/services/contactService.ts
interface ContactMessage {
    name: string;
    email: string;
    message: string;
  }
  
  export class ContactService {
    private readonly WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
    private readonly ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || '';
  
    public async sendMessage(data: ContactMessage): Promise<void> {
      try {
        console.log('Attempting to send message via Web3Forms...');
  
        const formData = new FormData();
        formData.append('access_key', this.ACCESS_KEY);
        formData.append('name', data.name);
        formData.append('email', data.email);
        formData.append('message', data.message);
        formData.append('subject', `Portfolio Contact: Message from ${data.name}`);
        formData.append('from_name', 'Portfolio Website Contact');
        formData.append('replyTo', data.email);
  
        const response = await fetch(this.WEB3FORMS_ENDPOINT, {
          method: 'POST',
          body: formData
        });
  
        const result = await response.json();
  
        if (result.success) {
          console.log('Message sent successfully:', result);
        } else {
          console.error('Failed to send message:', result);
          throw new Error(result.message || 'Failed to send message');
        }
  
      } catch (error) {
        console.error('Contact Service Error:', {
          error: error,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        if (error instanceof Error) {
          throw new Error(`Message sending failed: ${error.message}`);
        } else {
          throw new Error('Unknown error occurred while sending message');
        }
      }
    }
  
    public async validateConnection(): Promise<boolean> {
      try {
        const testData = {
          access_key: this.ACCESS_KEY,
          test: true
        };
  
        const response = await fetch(this.WEB3FORMS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testData)
        });
  
        const result = await response.json();
        return result.success === true;
  
      } catch (error) {
        console.error('Validation Error:', error);
        return false;
      }
    }
  }
  