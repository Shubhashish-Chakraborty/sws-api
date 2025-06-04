export function generateRandomPhoneNumber(): string {
    const digits = '0123456789';
    let number = '';
    for (let i = 0; i < 10; i++) {
        number += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return number;
}