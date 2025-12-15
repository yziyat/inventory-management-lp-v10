const fs = require('fs');
const path = 'src/components/movements/movements.component.html';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Regex to match 'Périmé /' followed by any whitespace (newlines etc) and 'Rebut'
    // We use the single quote context to be safe
    const regex = /'Périmé \/\s*Rebut'/g;

    if (regex.test(content)) {
        console.log('Found broken string. Fixing...');
        const newContent = content.replace(regex, "'Périmé / Rebut'");
        fs.writeFileSync(path, newContent, 'utf8');
        console.log('Successfully fixed the file.');
    } else {
        console.log('Pattern not found.');
        // Debug: print context around 'Périmé'
        const idx = content.indexOf('Périmé /');
        if (idx !== -1) {
            console.log('Found "Périmé /" at index ' + idx);
            console.log('Context (next 20 chars):');
            const context = content.substring(idx, idx + 20);
            console.log(JSON.stringify(context));
        } else {
            console.log('Could not find "Périmé /" in file.');
        }
    }
} catch (err) {
    console.error('Error:', err);
}
