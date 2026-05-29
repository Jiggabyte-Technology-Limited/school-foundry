import pptxgen from "pptxgenjs";

let pptx = new pptxgen();

pptx.layout = 'LAYOUT_16x9';

// Define theme colors
const theme = {
    primary: 'F97316',
    background: 'F5F4EF',
    surface: 'FFFFFF',
    textPrimary: '111827',
    textSecondary: '4B5563'
};

// Define Master Slide for consistent branding
pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { color: theme.background },
    objects: [
        { rect: { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: theme.primary } } }, // Top orange bar
    ],
    slideNumber: { x: '95%', y: '95%', fontFace: 'Inter', fontSize: 10, color: theme.textSecondary }
});

// Helper function to add standard slides
function addSlide(title, bodyBlocks, notes) {
    let slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    
    // Title
    slide.addText(title, {
        x: 0.5, y: 0.5, w: '90%', h: 1, 
        fontFace: 'Inter', fontSize: 32, bold: true, color: theme.primary
    });

    let currentY = 1.5;
    
    bodyBlocks.forEach(block => {
        if (block.subtitle) {
            slide.addText(block.subtitle, {
                x: 0.5, y: currentY, w: '90%', h: 0.5,
                fontFace: 'Inter', fontSize: 20, bold: true, color: theme.textPrimary
            });
            currentY += 0.5;
        }
        if (block.text) {
             slide.addText(block.text, {
                x: 0.5, y: currentY, w: '90%', h: 0.5,
                fontFace: 'Inter', fontSize: 18, color: theme.textSecondary
            });
            currentY += 0.5;
        }
        if (block.bullets && block.bullets.length > 0) {
            let bulletLines = block.bullets.map(b => ({ text: b, options: { bullet: true } }));
            slide.addText(bulletLines, {
                x: 0.7, y: currentY, w: '85%', h: block.bullets.length * 0.4,
                fontFace: 'Inter', fontSize: 18, color: theme.textSecondary,
                lineSpacing: 24
            });
            currentY += block.bullets.length * 0.4 + 0.2;
        }
    });

    if (notes) {
        slide.addNotes(notes);
    }
}

// Title Slide
let slide1 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide1.addText('School Foundry', {
    x: 0.5, y: 2.0, w: '90%', h: 1,
    fontFace: 'Inter', fontSize: 44, bold: true, color: theme.primary
});
slide1.addText([
    { text: 'Offline school office software for payments, receipts, statements, and class lists.\n', options: { color: theme.textPrimary, bold: true } },
    { text: 'Simple local-first administration for schools that cannot afford downtime.', options: { color: theme.textSecondary } }
], {
    x: 0.5, y: 3.0, w: '90%', h: 1.5,
    fontFace: 'Inter', fontSize: 20
});
slide1.addNotes('Open with the core promise: the office keeps moving even when the internet does not.');


// Slide 2
addSlide('The Problem', [{
    subtitle: 'What schools live with today',
    bullets: [
        'Payments are tracked in spreadsheets, notebooks, and memory',
        'Receipts take too long to issue or reconcile',
        'Statements are slow to prepare and easy to get wrong',
        'Class lists drift out of date',
        'Internet outages break the office rhythm'
    ]
}], 'Keep this grounded in real office pain, not software jargon.');

// Slide 3
addSlide('How the Platform Fits Together', [{
    subtitle: 'School Foundry is one system with five jobs',
    bullets: [
        'Learner registry and quick search',
        'Payment recording and balance tracking',
        'Receipts and statements on demand',
        'Class lists and exports for the office',
        'Backup and admin control for reliability'
    ]
}], 'Show the product as an operating system for the office, not a feature list.');

// Slide 4
addSlide('From Search to Payment', [{
    subtitle: 'Daily workflow',
    bullets: [
        '1. Search the learner by name or ID',
        '2. Open the account instantly',
        '3. Enter the payment',
        '4. Save and move straight to proof'
    ]
}], 'The value is speed. The staff should feel like the app removes friction, not adds steps.');

// Slide 5
addSlide('Receipts, Statements, and Class Lists', [{
    subtitle: 'What staff can produce',
    bullets: [
        'Receipt for immediate proof of payment',
        'Statement for balances and follow-up',
        'Class list for daily office use',
        'PDF export for printing and sharing',
        'Excel export for office editing and analysis'
    ]
}], 'Make it clear that output is part of the product, not a side feature.');

// Slide 6
addSlide('Why Offline Wins', [{
    subtitle: 'Offline means',
    bullets: [
        'No dependency on internet',
        'Work continues during outages',
        'Data stays on the school machine',
        'Printing is local and fast',
        'Backups are simple and under school control'
    ]
}], 'This is the strongest reason to buy. Say it plainly and with confidence.');

// Slide 7
addSlide('Why This Pays Back', [{
    subtitle: 'Value for the school',
    bullets: [
        'Faster office service',
        'Fewer receipting mistakes',
        'Cleaner audit trail',
        'Better parent trust',
        'Less reconciliation stress'
    ]
}, {
    subtitle: 'Value for the business',
    bullets: [
        'One-time deployment creates the first sale',
        'Training and support create ongoing revenue',
        'Offline hardware bundles raise the average order value',
        'Cloud sync becomes the next upsell, not the first dependency'
    ]
}], 'Tie product value to commercial value without sounding pushy.');

// Slide 8
addSlide('Admin Control Without Chaos', [{
    subtitle: 'Admin features',
    bullets: [
        'User accounts and permissions',
        'Activity logs',
        'School branding and settings',
        'Backup and restore',
        'Maintenance tools for recovery',
        'Built-in user guide for training'
    ]
}], 'The system needs to be easy for office staff, but still safe for the administrator.');

// Slide 9
addSlide('What the Offline Bundle Includes', [{
    subtitle: 'Bundle',
    bullets: [
        'Desktop app install',
        'Local database setup',
        'Branding setup',
        'Staff training',
        'Receipting and statements',
        'PDF and Excel export workflow',
        'Backup guidance'
    ]
}, {
    subtitle: 'Optional later',
    bullets: [
        'Cloud sync',
        'Remote access',
        'Parent portal',
        'Messaging add-ons'
    ]
}], 'Frame the offline bundle as the practical first step. Cloud comes later if the school wants it.');

// Slide 10
addSlide('Roadmap', [{
    subtitle: 'Now',
    text: 'Reliable offline office workflow'
}, {
    subtitle: 'Next',
    text: 'Cloud edition for remote access and multi-device use'
}, {
    subtitle: 'Later',
    text: 'Parent-facing features and central reporting'
}], 'Keep the roadmap short and credible. The first win is the offline install.');

// Slide 11
addSlide('What We Want From the Pilot', [{
    subtitle: 'We need to learn',
    bullets: [
        'Is it easy for office staff to use?',
        'Are the outputs clear enough?',
        'Does printing work with the school setup?',
        'Does the account view feel fast?',
        'What should improve first?'
    ]
}], 'Close with a real pilot question, not a generic marketing close.');

pptx.writeFile({ fileName: 'School_Foundry_Pilot.pptx' })
    .then(fileName => {
        console.log('created file: ' + fileName);
    });
