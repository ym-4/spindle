const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { hashPassword } = require('../src/models/Auth.model');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEFAULT_PASSWORD = 'password123';
const ADMIN_PASSWORD = 'admin123';
const hashedDefaultPassword = hashPassword(DEFAULT_PASSWORD);
const hashedAdminPassword = hashPassword(ADMIN_PASSWORD);

const persons = [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com', name: 'Bob' },
  { email: 'carol@example.com', name: 'Carol' },
  { email: 'dave@example.com', name: 'Dave' },
  { email: 'eve@example.com', name: 'Eve' },
  { email: 'frank@example.com', name: 'Frank' },
  { email: 'grace@example.com', name: 'Grace' },
  { email: 'heidi@example.com', name: 'Heidi' },
  { email: 'ivan@example.com', name: 'Ivan' },
  { email: 'judy@example.com', name: 'Judy' },
  { email: 'mallory@example.com', name: 'Mallory' },
  { email: 'oscar@example.com', name: 'Oscar' },
  { email: 'peggy@example.com', name: 'Peggy' },
  { email: 'trent@example.com', name: 'Trent' },
  { email: 'victor@example.com', name: 'Victor' },
  { email: 'walter@example.com', name: 'Walter' },
  { email: 'xavier@example.com', name: 'Xavier' },
  { email: 'yvonne@example.com', name: 'Yvonne' },
  { email: 'zara@example.com', name: 'Zara' },
  { email: 'leo@example.com', name: 'Leo' },
  { email: 'beni@example.com', name: 'Beni' },
  { email: 'emataso@example.com', name: 'Emataso' },
  { email: 'hinano@example.com', name: 'Hinano' },
];

const somethings = [{ name: 'Seed 1' }, { name: 'Seed 2' }];

// seed data for discussion pg
// Example posts
const posts = [
  {
    userEmail: 'alice@example.com',
    title: 'First Confession',
    category: 'confession',
    content: 'I love pineapple pizza!',
  },
  {
    userEmail: 'bob@example.com',
    title: 'Need Help',
    category: 'qna',
    content: 'How do I fix my seed script?',
  },
  {
    userEmail: 'carol@example.com',
    title: 'General Thoughts',
    category: 'general',
    content: 'Postgres is powerful.',
  },
];

// Example comments
const comments = [
  { userEmail: 'dave@example.com', postTitle: 'First Confession', content: 'Same here!' },
  { userEmail: 'eve@example.com', postTitle: 'Need Help', content: 'Try ON CONFLICT DO NOTHING.' },
];

// Example reactions
const reactions = [
  { userEmail: 'frank@example.com', postTitle: 'First Confession', reactionType: 'like' },
  { userEmail: 'grace@example.com', postTitle: 'Need Help', reactionType: 'dislike' },
];

// Example saved posts
const savedPosts = [{ userEmail: 'heidi@example.com', postTitle: 'General Thoughts' }];

// Marketplace items
const marketplaceItems = [
  {
    sellerEmail: 'alice@example.com',
    name: 'Backpack',
    description: 'Durable everyday backpack with multiple compartments.',
    price: 49.9,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Calculator',
    description: 'Scientific calculator suitable for engineering modules.',
    price: 15.0,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Folder',
    description: 'A4 document folder to keep your notes organised.',
    price: 3.5,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Notebook',
    description: 'Lined notebook, 200 pages, hardcover.',
    price: 6.9,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Paper',
    description: 'A4 80gsm printing paper, 500 sheets per ream.',
    price: 8.0,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Pen',
    description: 'Smooth ballpoint pen, blue ink.',
    price: 1.5,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Pencil',
    description: 'HB pencil, ideal for sketching and writing.',
    price: 0.8,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Stationery Pack',
    description: 'Bundle of essentials: pens, pencils, ruler, eraser, and sharpener.',
    price: 12.0,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Highlighter Set',
    description: 'Pack of 6 pastel highlighters, low bleed-through.',
    price: 5.5,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Sticky Notes',
    description: 'Assorted colour sticky notes, 5 pads.',
    price: 3.0,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Whiteboard Marker Set',
    description: 'Set of 4 whiteboard markers with eraser cap.',
    price: 4.5,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Correction Tape',
    description: 'Compact correction tape roller, 6m length.',
    price: 2.2,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: '30cm Ruler',
    description: 'Clear acrylic ruler with cm and inch markings.',
    price: 1.2,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Eraser',
    description: 'Soft white eraser, smudge-free.',
    price: 0.6,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Stapler',
    description: 'Compact desktop stapler with 1000 staples included.',
    price: 7.5,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Graph Paper Pad',
    description: 'Engineering graph paper pad, 50 sheets, 5mm grid.',
    price: 4.0,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Binder Clips Pack',
    description: 'Assorted size binder clips, 24 pieces.',
    price: 2.5,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Index Cards',
    description: 'Ruled index cards, 100 pieces, ring-bound.',
    price: 3.2,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Laptop Sleeve',
    description: '13-inch neoprene laptop sleeve, water-resistant.',
    price: 14.9,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'USB Flash Drive 32GB',
    description: 'Compact USB 3.0 flash drive, 32GB capacity.',
    price: 9.9,
    quality: 'Brand New',
    meetup: 'Dover MRT',
  },

  {
    sellerEmail: 'alice@example.com',
    name: 'Introduction to Algorithms Textbook',
    description: 'CLRS 3rd edition, some highlighting in first 3 chapters.',
    price: 35.0,
    quality: 'Good',
    meetup: 'Clementi MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Mechanical Keyboard',
    description: 'TKL mechanical keyboard with brown switches, RGB backlight.',
    price: 55.0,
    quality: 'Like New',
    meetup: 'Buona Vista MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Study Desk Lamp',
    description: 'Adjustable LED desk lamp with 3 brightness settings.',
    price: 18.0,
    quality: 'Good',
    meetup: 'Jurong East MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Office Chair',
    description: 'Ergonomic mesh-back office chair, minor scuffs on base.',
    price: 60.0,
    quality: 'Fair',
    meetup: 'Tampines MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Wireless Mouse',
    description: 'Bluetooth wireless mouse, works perfectly, light scratches on top.',
    price: 8.5,
    quality: 'Fair',
    meetup: 'Bishan MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Discrete Mathematics Notes (Printed)',
    description: 'Compiled lecture notes and past year papers, spiral-bound.',
    price: 6.0,
    quality: 'Good',
    meetup: 'Serangoon MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'External SSD 500GB',
    description: 'Portable USB-C SSD, fast transfer speeds, barely used.',
    price: 65.0,
    quality: 'Like New',
    meetup: 'Yishun MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Study Table (Foldable)',
    description: 'Foldable laptop table, some wear on the surface.',
    price: 20.0,
    quality: 'Well Used',
    meetup: 'Woodlands MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Noise-Cancelling Headphones',
    description: 'Over-ear ANC headphones, minor cosmetic wear, great sound.',
    price: 70.0,
    quality: 'Good',
    meetup: 'Punggol MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Raspberry Pi 4 (4GB)',
    description: 'Used for a semester-long IoT project, fully functional.',
    price: 45.0,
    quality: 'Good',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Breadboard and Jumper Wires Kit',
    description: 'Electronics prototyping kit, a few wires slightly bent.',
    price: 10.0,
    quality: 'Fair',
    meetup: 'Clementi MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Arduino Uno Starter Kit',
    description: 'Complete starter kit with sensors, mostly unused.',
    price: 30.0,
    quality: 'Like New',
    meetup: 'Buona Vista MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Database Systems Textbook',
    description: 'Elmasri & Navathe, cover slightly bent, no writing inside.',
    price: 25.0,
    quality: 'Good',
    meetup: 'Jurong East MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Monitor Stand Riser',
    description: 'Wooden monitor stand with storage space underneath.',
    price: 12.0,
    quality: 'Good',
    meetup: 'Tampines MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Graphing Calculator (TI-84)',
    description: 'TI-84 Plus, buttons slightly worn but fully functional.',
    price: 40.0,
    quality: 'Fair',
    meetup: 'Bishan MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Bean Bag Chair',
    description: 'Comfy bean bag for dorm room, some fading on fabric.',
    price: 15.0,
    quality: 'Well Used',
    meetup: 'Serangoon MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Portable Whiteboard',
    description: 'A3-size portable whiteboard, great for practicing diagrams.',
    price: 9.0,
    quality: 'Good',
    meetup: 'Yishun MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Bluetooth Speaker',
    description: 'Compact portable speaker, decent battery life.',
    price: 20.0,
    quality: 'Fair',
    meetup: 'Woodlands MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Mini Fridge',
    description: 'Compact dorm-size fridge, works well, some rust on hinge.',
    price: 80.0,
    quality: 'Well Used',
    meetup: 'Punggol MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Computer Networking Textbook',
    description: 'Kurose & Ross top-down approach, 7th edition.',
    price: 28.0,
    quality: 'Good',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Webcam 1080p',
    description: 'HD webcam with built-in mic, used for online classes.',
    price: 18.0,
    quality: 'Like New',
    meetup: 'Clementi MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Drawing Tablet',
    description: 'Small graphics tablet for digital sketching, pen included.',
    price: 35.0,
    quality: 'Good',
    meetup: 'Buona Vista MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Study Chair Cushion',
    description: 'Memory foam seat cushion for long study sessions.',
    price: 10.0,
    quality: 'Brand New',
    meetup: 'Jurong East MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Physics for Scientists Textbook',
    description: 'Serway & Jewett, some annotations in pencil.',
    price: 22.0,
    quality: 'Fair',
    meetup: 'Tampines MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Laptop Stand (Adjustable)',
    description: 'Aluminium laptop stand, improves posture and airflow.',
    price: 16.0,
    quality: 'Like New',
    meetup: 'Bishan MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Desk Organizer Tray',
    description: 'Multi-compartment tray for pens, cables, and stationery.',
    price: 7.0,
    quality: 'Good',
    meetup: 'Serangoon MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Router (Dual-Band)',
    description: 'Home Wi-Fi router, reliable for dorm/home use.',
    price: 25.0,
    quality: 'Fair',
    meetup: 'Yishun MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Study Bookshelf (Small)',
    description: '3-tier bookshelf, some scratches on the sides.',
    price: 18.0,
    quality: 'Well Used',
    meetup: 'Woodlands MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Portable Monitor 15.6"',
    description: 'USB-C portable monitor, great for a dual-screen setup.',
    price: 90.0,
    quality: 'Like New',
    meetup: 'Punggol MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Cybersecurity Fundamentals Textbook',
    description: 'Covers OWASP Top 10 and network security basics.',
    price: 20.0,
    quality: 'Good',
    meetup: 'Dover MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Mechanical Pencil Set',
    description: 'Set of 3 mechanical pencils with extra lead refills.',
    price: 4.5,
    quality: 'Brand New',
    meetup: 'Clementi MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Table Fan',
    description: 'Compact desk fan, 3 speed settings, quiet motor.',
    price: 12.0,
    quality: 'Fair',
    meetup: 'Buona Vista MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'HDMI Cable (2m)',
    description: 'High-speed HDMI cable, supports 4K resolution.',
    price: 5.0,
    quality: 'Brand New',
    meetup: 'Jurong East MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Ethernet Cable (5m)',
    description: 'Cat6 ethernet cable, good for stable connections.',
    price: 6.0,
    quality: 'Like New',
    meetup: 'Tampines MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Storage Bins (Set of 3)',
    description: 'Stackable plastic storage bins, ideal for dorm rooms.',
    price: 14.0,
    quality: 'Good',
    meetup: 'Bishan MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Study Timer / Clock',
    description: 'Digital timer clock, useful for Pomodoro study sessions.',
    price: 8.0,
    quality: 'Fair',
    meetup: 'Serangoon MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Portable Scanner',
    description: 'Compact document scanner, scans directly to USB drive.',
    price: 30.0,
    quality: 'Well Used',
    meetup: 'Yishun MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Yoga Mat',
    description: 'Non-slip yoga mat, used occasionally for stretching breaks.',
    price: 10.0,
    quality: 'Good',
    meetup: 'Woodlands MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Water Bottle (Insulated)',
    description: '750ml stainless steel insulated bottle, keeps drinks cold.',
    price: 9.0,
    quality: 'Like New',
    meetup: 'Punggol MRT',
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Software Engineering Textbook',
    description: 'Sommerville 10th edition, covers CI/CD and agile methods.',
    price: 27.0,
    quality: 'Good',
    meetup: 'Dover MRT',
  },
];

module.exports = marketplaceItems;

// Seed data for groups
// Example Groups
const groups = [
  // ===== SOC (5 groups) =====
  {
    name: 'SOC Study Buddies',
    creatorEmail: 'alice@example.com',
    description: 'General CS study group.',
    school: 'SOC',
    module: 'CS1010',
    public: true,
  },
  {
    name: 'SOC Algorithms',
    creatorEmail: 'bob@example.com',
    description: 'Algorithms and data structures.',
    school: 'SOC',
    module: 'CS2040',
    public: true,
  },
  {
    name: 'SOC Database Club',
    creatorEmail: 'carol@example.com',
    description: 'Database systems discussions.',
    school: 'SOC',
    module: 'CS2102',
    public: false,
  },
  {
    name: 'SOC Software Engineering',
    creatorEmail: 'dave@example.com',
    description: 'Software engineering project help.',
    school: 'SOC',
    module: 'CS2103',
    public: false,
  },
  {
    name: 'SOC AI Learners',
    creatorEmail: 'eve@example.com',
    description: 'Artificial Intelligence study group.',
    school: 'SOC',
    module: 'CS3243',
    public: true,
  },

  // ===== Other Schools =====
  {
    name: 'MAD Project Team',
    creatorEmail: 'frank@example.com',
    description: 'Mobile app development.',
    school: 'MAD',
    module: 'CP2106',
    public: true,
  },
  {
    name: 'SMA Dream Team',
    creatorEmail: 'beni@example.com',
    description: 'Marine Ships.',
    school: 'SMA',
    module: 'SM1029',
    public: false,
  },
  {
    name: 'EEE Circuit Masters',
    creatorEmail: 'grace@example.com',
    description: 'Circuits and electronics.',
    school: 'EEE',
    module: 'EE2020',
    public: true,
  },
  {
    name: 'Business Case Club',
    creatorEmail: 'heidi@example.com',
    description: 'Business presentations and case studies.',
    school: 'SB',
    module: 'BM1010',
    public: false,
  },
  {
    name: 'Design Studio',
    creatorEmail: 'ivan@example.com',
    description: 'Design critiques and portfolio reviews.',
    school: 'MAD',
    module: 'DX1001',
    public: true,
  },
  {
    name: 'Engineering Mechanics',
    creatorEmail: 'judy@example.com',
    description: 'Mechanical engineering study group.',
    school: 'MAE',
    module: 'ME2001',
    public: true,
  },
  {
    name: 'Applied Science Hub',
    creatorEmail: 'mallory@example.com',
    description: 'Applied science discussions.',
    school: 'CLS',
    module: 'CH101',
    public: false,
  },
];

// Example GroupMembers
const groupMembers = [
  // ===== SOC Study Buddies =====
  { groupName: 'SOC Study Buddies', userEmail: 'alice@example.com', role: 'admin' },
  { groupName: 'SOC Study Buddies', userEmail: 'bob@example.com', role: 'user' },
  { groupName: 'SOC Study Buddies', userEmail: 'carol@example.com', role: 'user' },
  { groupName: 'SOC Study Buddies', userEmail: 'dave@example.com', role: 'user' },
  { groupName: 'SOC Study Buddies', userEmail: 'eve@example.com', role: 'user' },
  { groupName: 'SOC Study Buddies', userEmail: 'beni@example.com', role: 'user' },

  // ===== SOC Algorithms =====
  { groupName: 'SOC Algorithms', userEmail: 'bob@example.com', role: 'admin' },
  { groupName: 'SOC Algorithms', userEmail: 'alice@example.com', role: 'user' },
  { groupName: 'SOC Algorithms', userEmail: 'frank@example.com', role: 'user' },
  { groupName: 'SOC Algorithms', userEmail: 'grace@example.com', role: 'user' },
  { groupName: 'SOC Algorithms', userEmail: 'heidi@example.com', role: 'user' },
  { groupName: 'SOC Algorithms', userEmail: 'ivan@example.com', role: 'user' },

  // ===== SOC Database Club =====
  { groupName: 'SOC Database Club', userEmail: 'carol@example.com', role: 'admin' },
  { groupName: 'SOC Database Club', userEmail: 'judy@example.com', role: 'user' },
  { groupName: 'SOC Database Club', userEmail: 'leo@example.com', role: 'user' },
  { groupName: 'SOC Database Club', userEmail: 'oscar@example.com', role: 'user' },
  { groupName: 'SOC Database Club', userEmail: 'peggy@example.com', role: 'user' },
  { groupName: 'SOC Database Club', userEmail: 'trent@example.com', role: 'user' },

  // ===== SOC Software Engineering =====
  { groupName: 'SOC Software Engineering', userEmail: 'dave@example.com', role: 'admin' },
  { groupName: 'SOC Software Engineering', userEmail: 'victor@example.com', role: 'user' },
  { groupName: 'SOC Software Engineering', userEmail: 'walter@example.com', role: 'user' },
  { groupName: 'SOC Software Engineering', userEmail: 'xavier@example.com', role: 'user' },
  { groupName: 'SOC Software Engineering', userEmail: 'yvonne@example.com', role: 'user' },
  { groupName: 'SOC Software Engineering', userEmail: 'zara@example.com', role: 'user' },

  // ===== SOC AI Learners =====
  { groupName: 'SOC AI Learners', userEmail: 'eve@example.com', role: 'admin' },
  { groupName: 'SOC AI Learners', userEmail: 'alice@example.com', role: 'user' },
  { groupName: 'SOC AI Learners', userEmail: 'beni@example.com', role: 'user' },
  { groupName: 'SOC AI Learners', userEmail: 'emataso@example.com', role: 'user' },
  { groupName: 'SOC AI Learners', userEmail: 'hinano@example.com', role: 'user' },
  { groupName: 'SOC AI Learners', userEmail: 'leo@example.com', role: 'user' },

  // ===== MAD =====
  { groupName: 'MAD Project Team', userEmail: 'frank@example.com', role: 'admin' },
  { groupName: 'MAD Project Team', userEmail: 'grace@example.com', role: 'user' },
  { groupName: 'MAD Project Team', userEmail: 'heidi@example.com', role: 'user' },
  { groupName: 'MAD Project Team', userEmail: 'ivan@example.com', role: 'user' },
  { groupName: 'MAD Project Team', userEmail: 'judy@example.com', role: 'user' },

  // ===== EEE =====
  { groupName: 'EEE Circuit Masters', userEmail: 'grace@example.com', role: 'admin' },
  { groupName: 'EEE Circuit Masters', userEmail: 'frank@example.com', role: 'user' },
  { groupName: 'EEE Circuit Masters', userEmail: 'mallory@example.com', role: 'user' },
  { groupName: 'EEE Circuit Masters', userEmail: 'oscar@example.com', role: 'user' },
  { groupName: 'EEE Circuit Masters', userEmail: 'peggy@example.com', role: 'user' },

  // ===== SB =====
  { groupName: 'Business Case Club', userEmail: 'heidi@example.com', role: 'admin' },
  { groupName: 'Business Case Club', userEmail: 'trent@example.com', role: 'user' },
  { groupName: 'Business Case Club', userEmail: 'victor@example.com', role: 'user' },
  { groupName: 'Business Case Club', userEmail: 'walter@example.com', role: 'user' },

  // ===== DMAD =====
  { groupName: 'Design Studio', userEmail: 'ivan@example.com', role: 'admin' },
  { groupName: 'Design Studio', userEmail: 'xavier@example.com', role: 'user' },
  { groupName: 'Design Studio', userEmail: 'yvonne@example.com', role: 'user' },
  { groupName: 'Design Studio', userEmail: 'zara@example.com', role: 'user' },

  // ===== MAE =====
  { groupName: 'Engineering Mechanics', userEmail: 'judy@example.com', role: 'admin' },
  { groupName: 'Engineering Mechanics', userEmail: 'alice@example.com', role: 'user' },
  { groupName: 'Engineering Mechanics', userEmail: 'bob@example.com', role: 'user' },
  { groupName: 'Engineering Mechanics', userEmail: 'carol@example.com', role: 'user' },

  // ===== SAS =====
  { groupName: 'Applied Science Hub', userEmail: 'mallory@example.com', role: 'admin' },
  { groupName: 'Applied Science Hub', userEmail: 'leo@example.com', role: 'user' },
  { groupName: 'Applied Science Hub', userEmail: 'beni@example.com', role: 'user' },
  { groupName: 'Applied Science Hub', userEmail: 'emataso@example.com', role: 'user' },
];

// Example Group Discussions
const groupDiscussions = [
  // SOC Study Buddies
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'alice@example.com',
    channel_name: 'general',
    message: 'Welcome everyone! Feel free to share your notes here.',
  },
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'bob@example.com',
    channel_name: 'general',
    message: 'Anyone understands recursion for CS1010?',
  },
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    channel_name: 'resources',
    message: 'I uploaded last year’s practical exam solutions.',
  },
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    channel_name: 'general',
    message: 'When is the CA2 due?',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'emataso@example.com',
    channel_name: 'general',
    message: 'Next week',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    channel_name: 'general',
    message: '😭',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'hinano@example.com',
    channel_name: 'general',
    message: 'Hey, did you finish the assignment?',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'alice@example.com',
    channel_name: 'general',
    message: 'Yeah, I just submitted it 👍',
  },

  // MAD Project Team
  {
    groupName: 'MAD Project Team',
    userEmail: 'dave@example.com',
    channel_name: 'project',
    message: 'Can we finalize the UI design by Friday?',
  },
  {
    groupName: 'MAD Project Team',
    userEmail: 'eve@example.com',
    channel_name: 'general',
    message: 'I will handle the frontend integration.',
  },
  {
    groupName: 'MAD Project Team',
    userEmail: 'eve@example.com',
    channel_name: 'design',
    message: 'I created new Figma mockups for the dashboard.',
  },

  // EEE Circuit Masters
  {
    groupName: 'EEE Circuit Masters',
    userEmail: 'carol@example.com',
    channel_name: 'labs',
    message: 'Reminder: Lab report due next Monday.',
  },
  {
    groupName: 'EEE Circuit Masters',
    userEmail: 'frank@example.com',
    channel_name: 'general',
    message: 'Does anyone know how to solve Question 3?',
  },
  {
    groupName: 'EEE Circuit Masters',
    userEmail: 'emataso@example.com',
    channel_name: 'exam-prep',
    message: 'I made a summary sheet for the circuit formulas.',
  },
];

// Example Group Announcements
const groupAnnouncements = [
  {
    announcementId: 1,
    groupName: 'SOC Study Buddies',
    userEmail: 'alice@example.com',
    text: '📢 Welcome to SOC Study Buddies! Please introduce yourself in the general channel.',
  },
  {
    announcementId: 2,
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    text: 'Reminder: CS1010 assignment is due this Friday at 11:59 PM.',
  },
  {
    announcementId: 3,
    groupName: 'MAD Project Team',
    userEmail: 'bob@example.com',
    text: 'Sprint 2 starts tomorrow. Please update your assigned tasks.',
  },
  {
    announcementId: 4,
    groupName: 'MAD Project Team',
    userEmail: 'bob@example.com',
    text: 'Team meeting this Thursday at 3:00 PM in Classroom T203.',
  },
  {
    announcementId: 5,
    groupName: 'EEE Circuit Masters',
    userEmail: 'carol@example.com',
    text: 'Lab report submission deadline has been extended to Wednesday.',
  },
  {
    announcementId: 6,
    groupName: 'EEE Circuit Masters',
    userEmail: 'carol@example.com',
    text: 'Exam revision session will be held this Saturday at 10 AM.',
  },
];

async function seed() {
  console.log('Seeding data...');

  // Insert persons
  for (const person of persons) {
    const hashedPassword = await bcrypt.hash(
      person.hashed_password?.toString() || 'password123',
      10,
    );

    await pool.query(
      `INSERT INTO "Person" ("email", "name", "hashed_password") VALUES ($1, $2, $3) ON CONFLICT ("email") DO NOTHING`,
      [person.email, person.name, hashedPassword],
    );
  }
  console.log(`Inserted ${persons.length} persons.`);

  // Insert somethings (batch)
  if (somethings.length > 0) {
    const somethingPlaceholders = somethings.map((_, i) => `($${i + 1})`);
    const somethingValues = somethings.map((s) => s.name);
    await pool.query(
      `INSERT INTO "Something" ("name") VALUES ${somethingPlaceholders.join(', ')}`,
      somethingValues,
    );
  }
  console.log(`Inserted ${somethings.length} somethings.`);

  // Auth-ready users (hashed passwords + verified email for login)
  await pool.query(
    `INSERT INTO "Person" (email, name, hashed_password, role, email_verified)
     VALUES ('admin@campushub.sp', 'Admin', $1, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password, role = 'admin', email_verified = TRUE`,
    [hashedAdminPassword],
  );
  await pool.query(
    `UPDATE "Person" SET hashed_password = $1, email_verified = TRUE, role = 'user'
     WHERE email != 'admin@campushub.sp'`,
    [hashedDefaultPassword],
  );
  console.log('Set passwords (password123) and verified emails for all users.');

  const aliceRes = await pool.query(`SELECT id FROM "Person" WHERE email = 'alice@example.com'`);
  const bobRes = await pool.query(`SELECT id FROM "Person" WHERE email = 'bob@example.com'`);
  const aliceId = aliceRes.rows[0]?.id;
  const bobId = bobRes.rows[0]?.id;
  if (aliceId && bobId) {
    await pool.query(
      `INSERT INTO "FriendRequests" (sender_id, receiver_id, status) VALUES ($1, $2, 'accepted')
       ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'accepted'`,
      [aliceId, bobId],
    );
    await pool.query(
      `INSERT INTO "UserFriends" (user_id, friend_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING`,
      [aliceId, bobId],
    );
    await pool.query(
      `INSERT INTO "PersonalMessages" (sender_id, recipient_id, body) VALUES ($1, $2, 'Hey Bob! Want to study together?')`,
      [aliceId, bobId],
    );
    console.log('Seeded Alice/Bob friendship and sample message.');
    await pool.query(
      `UPDATE "Person" SET display_name = 'Alice', bio = $1, headline = $2, location = $3,
       skills = $4::jsonb, link_github = $5, link_linkedin = $6
       WHERE id = $7`,
      [
        'CS student at SP. I build study tools and love helping classmates with assignments.',
        'Computer Science Student',
        'Singapore',
        JSON.stringify(['JavaScript', 'Python', 'Study Groups', 'UI Design']),
        'alice-dev',
        'alice-khan',
        aliceId,
      ],
    );
  }

  // Discussion board extras
  console.log('Seed data inserted successfully.');

  // homepg function
  // Insert posts
  for (const post of posts) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [post.userEmail]);
    if (userRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "Posts" ("user_id", "title", "category", "content")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, post.title, post.category, post.content],
      );
    }
  }
  console.log(`Inserted ${posts.length} posts.`);

  // Insert comments
  for (const comment of comments) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      comment.userEmail,
    ]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [
      comment.postTitle,
    ]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "PostComments" ("user_id", "post_id", "content")
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, postRes.rows[0].id, comment.content],
      );
    }
  }
  console.log(`Inserted ${comments.length} comments.`);

  // Insert reactions
  for (const reaction of reactions) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      reaction.userEmail,
    ]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [
      reaction.postTitle,
    ]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "PostReactions" ("post_id", "user_id", "reaction_type")
         VALUES ($1, $2, $3)
         ON CONFLICT ("post_id", "user_id") DO NOTHING`,
        [postRes.rows[0].id, userRes.rows[0].id, reaction.reactionType],
      );
    }
  }
  console.log(`Inserted ${reactions.length} reactions.`);

  // Insert saved posts
  for (const saved of savedPosts) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [saved.userEmail]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [saved.postTitle]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "SavedPosts" ("user_id", "post_id")
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, postRes.rows[0].id],
      );
    }
  }
  console.log(`Inserted ${savedPosts.length} saved posts.`);

  // // Insert groups
  // for (const group of groups) {
  //   const creatorRes = await pool.query(
  //     `SELECT id FROM "Person" WHERE email = $1`,
  //     [group.creatorEmail]
  //   );

  //   if (creatorRes.rows.length > 0) {
  //     await pool.query(
  //       `INSERT INTO "Groups"
  //       ("name", "creator_id", "description", "school", "module", "public")
  //       VALUES ($1, $2, $3, $4, $5, $6)
  //       ON CONFLICT ("name") DO NOTHING`,
  //       [
  //         group.name,
  //         creatorRes.rows[0].id,
  //         group.description,
  //         group.school,
  //         group.module,
  //         group.public,
  //       ]
  //     );
  //   }
  // }

  // console.log(`Inserted ${groups.length} groups.`);

  //   // Insert group members
  // for (const gm of groupMembers) {
  //   const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [gm.userEmail]);
  //   const groupRes = await pool.query(`SELECT id FROM "Groups" WHERE name = $1`, [gm.groupName]);

  //   if (userRes.rows.length > 0 && groupRes.rows.length > 0) {
  //     await pool.query(
  //       `INSERT INTO "GroupMembers" ("group_id", "user_id", "role")
  //        VALUES ($1, $2, $3)
  //        ON CONFLICT DO NOTHING`,
  //       [groupRes.rows[0].id, userRes.rows[0].id, gm.role],
  //     );
  //   }
  // }
  // console.log(`Inserted ${groupMembers.length} group members.`);

  // Insert marketplace items
  const sellerRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
    'alice@example.com',
  ]);
  if (sellerRes.rows.length > 0) {
    const sellerId = sellerRes.rows[0].id;
    for (const item of marketplaceItems) {
      await pool.query(
        `INSERT INTO "MarketplaceItems" ("seller_id", "name", "description", "price", "quality",  "meetup")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
        [sellerId, item.name, item.description, item.price, item.quality, item.meetup],
      );
    }
  }
  console.log(`Inserted ${marketplaceItems.length} marketplace items.`);

  // Insert groups
  for (const group of groups) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      group.creatorEmail,
    ]);

    if (userRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "Groups" ("name", "creator_id", "description", "school", "module")
         VALUES ($1, $2, $3, $4, $5)`,
        [group.name, userRes.rows[0].id, group.description, group.school, group.module],
      );
    }
  }

  console.log(`Inserted ${groups.length} groups.`);

  // Insert group members
  for (const member of groupMembers) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      member.userEmail,
    ]);

    const groupRes = await pool.query(`SELECT id FROM "Groups" WHERE name = $1`, [
      member.groupName,
    ]);

    if (userRes.rows.length > 0 && groupRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "GroupMembers" ("group_id", "user_id", "role")
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING`,
        [groupRes.rows[0].id, userRes.rows[0].id, member.role],
      );
    }
  }

  console.log(`Inserted ${groupMembers.length} group members.`);

  // Insert group discussions
  for (const discussion of groupDiscussions) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      discussion.userEmail,
    ]);

    const groupRes = await pool.query(`SELECT id FROM "Groups" WHERE name = $1`, [
      discussion.groupName,
    ]);

    if (userRes.rows.length > 0 && groupRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "GroupDiscussions"
        ("group_id", "user_id", "channel_name", "message")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING`,
        [groupRes.rows[0].id, userRes.rows[0].id, discussion.channel_name, discussion.message],
      );
    }
  }

  // Insert group announcements
  for (const announcement of groupAnnouncements) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      announcement.userEmail,
    ]);

    const groupRes = await pool.query(`SELECT id FROM "Groups" WHERE name = $1`, [
      announcement.groupName,
    ]);

    if (userRes.rows.length > 0 && groupRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "GroupAnnouncements"
        ("announcement_id", "user_id", "group_id", "text")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("announcement_id") DO NOTHING`,
        [announcement.announcementId, userRes.rows[0].id, groupRes.rows[0].id, announcement.text],
      );
    }
  }

  console.log(`Inserted ${groupAnnouncements.length} group announcements.`);

  console.log(`Inserted ${groupDiscussions.length} group discussions.`);

  console.log('Seed completed successfully.');
  console.log(
    `Login: Alice/Bob password "${DEFAULT_PASSWORD}", Admin password "${ADMIN_PASSWORD}"`,
  );
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });
