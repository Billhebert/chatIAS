const fs = require('fs');
const filePath = 'C:\\Users\\Bill\\.local\\share\\opencode\\tool-output\\tool_bb15d4f3a001nPjMcuR2Apbc8S';
const content = fs.readFileSync(filePath, 'utf8');
const json = JSON.parse(content);

const rows = json.data.rows;

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.includes('@') && email.includes('.');
}

function cleanPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits;
}

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  // More than 8 digits after removing non-numeric, and not just "55"
  if (digits.length <= 8) return false;
  if (digits === '55') return false;
  return true;
}

const results = [];

for (const row of rows) {
  const name = row.name || '';
  const email1 = row.email1 || '';
  const email2 = row.email2 || '';
  const phone1 = row.phone1 || '';
  const phone2 = row.phone2 || '';
  
  // Check if any valid email or phone
  const hasValidEmail = isValidEmail(email1) || isValidEmail(email2);
  const hasValidPhone = isValidPhone(phone1) || isValidPhone(phone2);
  
  if (hasValidEmail || hasValidPhone) {
    // Determine which email and phone to use
    let emailToUse = null;
    if (isValidEmail(email1)) emailToUse = email1;
    else if (isValidEmail(email2)) emailToUse = email2;
    
    let phoneToUse = null;
    if (isValidPhone(phone1)) phoneToUse = cleanPhone(phone1);
    else if (isValidPhone(phone2)) phoneToUse = cleanPhone(phone2);
    
    results.push({
      name: name,
      email: emailToUse,
      phone: phoneToUse
    });
  }
}

// Generate the JavaScript code
let output = 'const CONFIRM8_DATA = [\n';
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const emailStr = r.email ? `"${r.email}"` : 'null';
  const phoneStr = r.phone ? `"${r.phone}"` : 'null';
  const comma = i < results.length - 1 ? ',' : '';
  output += `  { name: "${r.name.replace(/"/g, '\\"')}", email: ${emailStr}, phone: ${phoneStr} }${comma}\n`;
}
output += '];\n';

console.log('Total clients in file:', rows.length);
console.log('Clients with valid email or phone:', results.length);
console.log('\n--- OUTPUT ---\n');
console.log(output);
