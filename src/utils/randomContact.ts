export function generateRandomPhoneNumber(): string {
    const startingDigits = ['9', '8'];
    const digits = '0123456789';

    let number = startingDigits[Math.floor(Math.random() * startingDigits.length)];

    for (let i = 0; i < 9; i++) {
        number += digits.charAt(Math.floor(Math.random() * digits.length));
    }

    return number;
}