// Wait, git diff showed nothing? Let's check script.js
const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');
console.log(code.includes("add-bot-btn"));
