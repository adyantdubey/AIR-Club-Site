/**
 * Real club content, brought over from the previous website (airclub.nitandhra.ac.in) in Oct 2026.
 *
 * Used two ways:
 *  - demo mode loads it through src/data/seed.js
 *  - supabase/seed_content.sql is generated from it (node supabase/make-seed-sql.mjs)
 *
 * Photos still live on the club's Google Drive (same links the old site used). If one fails
 * to load, the page shows a placeholder instead. 9 of the 47 old links no longer work
 * (marked below) — upload those photos again in the admin area.
 *
 * Long write-ups use a tiny format:  "## Heading"  ·  "- bullet"  ·  blank line = new paragraph.
 */

export const drive = (id, width = 1000) => (id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : '');

/* ------------------------------------------------------------------ club facts */
export const CLUB = {
  club_name: 'AI & Robotics Club',
  tagline: 'Transforming Visions into Reality.',
  email: 'airclub@nitandhra.ac.in',
  phone: '+91 7783847276',
  address: '102, Student Amenities Centre, NIT Andhra Pradesh, Tadepalligudem',
  linkedin: 'https://www.linkedin.com/company/artificial-intelligence-and-robotics-club-nit-andhra-pradesh/about/',
  instagram: 'https://www.instagram.com/ai_and_robotics_nitandhra/',
  youtube: 'https://www.youtube.com/@airclubnitap724',
  github: '',
  mission:
    'To cultivate innovation and collaboration among members in exploring artificial intelligence and robotics technologies. Through hands-on projects, we empower members to tackle real-world challenges and drive positive societal impact.',
};

export const ABOUT = {
  lead: 'In the heart of our university, the Artificial Intelligence and Robotics Club stands as a vibrant community of like-minded individuals, brought together by a shared passion for the fascinating realms of Artificial Intelligence and Robotics. Our mission is clear: to ignite curiosity, foster innovation, and actively contribute to the advancement of technology.',
  more: "What sets our club apart is the diversity of our members' backgrounds. Whether you're a computer scientist, an electrical engineer, an electronics and communication specialist, a mechanical engineer, or from any other domain of engineering, you'll find a welcoming place here. Our unique blend of skills and perspectives enriches our projects and discussions, fostering an environment of innovation and cross-disciplinary collaboration.",
  community:
    "Our club offers a vibrant community where members engage in workshops, projects, and activities designed to deepen their understanding and practical skills in these cutting-edge fields. Whether you're an experienced enthusiast or new to the world of AI and robotics, there's something here for everyone.",
  signoff: 'Come, Innovate, and Create',
};

export const VALUES = [
  ['Embrace failure as a stepping stone', 'Failure is not the end but a crucial part of the learning process. Embrace failure as a stepping stone toward success.'],
  ['Foster collaboration and diversity', 'Collaboration and diversity are key to driving innovation and creating meaningful solutions.'],
];

export const FAQ = [
  [
    'What kind of activities does the AI and Robotics Club offer?',
    'The club offers a range of activities including hands-on workshops, project building sessions, guest lectures, and discussions on topics related to artificial intelligence and robotics.',
  ],
  [
    'Do I need prior experience in AI or robotics to join the club?',
    'No prior experience is required! The club welcomes members with varying levels of expertise, from beginners to advanced enthusiasts. Our activities cater to all skill levels and provide opportunities for learning and growth.',
  ],
  [
    'How can I get involved in projects within the club?',
    'Members can get involved in projects by attending project brainstorming sessions, expressing interest in ongoing projects, or proposing new project ideas. Collaborative teamwork is encouraged, and members can contribute their skills and ideas to various projects.',
  ],
  [
    'What resources does the club provide for learning AI and robotics?',
    'The club provides access to a range of hardware resources essential for learning about AI and robotics, including microcontrollers, sensors, actuators, and other electronic components. Additionally, members have access to hands-on workshops, tutorials, and projects that utilize these hardware tools.',
  ],
];

/* ------------------------------------------------------------------ faculty */
export const FACULTY = [
  {
    name: 'Dr. Thella Babu Rao',
    role: 'Faculty Coordinator',
    department: 'NIT Andhra Pradesh',
    email: 'thellababurao@nitandhra.ac.in',
    photo_url: '/faculty/thella-babu-rao.jpg',
    bio: 'Faculty Coordinator of the AI and Robotics Club.',
  },
];

/* ------------------------------------------------------------------ team (from the previous site — placeholder until the new list is sent) */
// [name, role, Drive photo id, LinkedIn]
const TEAM_ROWS = [
  ['Vivek Ranjan', 'Secretary', '1P3Zolt3SMD46uYpBPAnQ6W6lqgPnozFq', 'https://www.linkedin.com/in/vivek-ranjan-b33769229/'],
  ['Kashik Janbandhu', 'Co-Secretary', '10ex3ginfCRVepvzVmv0HO-H_s-cgBPeZ', 'https://www.linkedin.com/in/kashik-janbandhu-345a7b179/'],
  ['Madhav Bhansali', 'Co-Secretary', '1rQKVn_MI1DwThs7lXnYHEJy-eIFKqQSE', 'https://www.linkedin.com/in/madhav-bhansali-649261252/'],
  ['Adyanta Dubey', 'Joint Secretary', '1TTeQaDyYafArSwZsU6S7s4u7BP-ilKrH', 'https://www.linkedin.com/in/adyanta-dubey-a57895225/'],
  ['Mehul Jain', 'Joint Secretary', '1PD7ty8BawC-lqkobRs7k8VcNj5GpHpc9', 'https://www.linkedin.com/in/mehul-kocheta/'],
  ['Jom George', 'Joint Secretary', '16VK0kzQ5Ro5dYItccWnTtl5w8fpek4D7', 'https://www.linkedin.com/in/jom-george-36318b253/'],
  ['G Shweta', 'Head of Management', '13wlslxV8tXv5a22GI00X77oKXoOcKve_', 'https://www.linkedin.com/in/g-shweta-880104246/'],
  ['Krishna Tayal', 'Head of Media and Outreach', ''  /* photo link no longer works */, 'https://www.linkedin.com/in/krishnataayal/'],
  ['Sriya Varshini', 'Executive Member', '1WXeJDpDmt74JKGhKdxIwviX4WYhAfD8C', 'https://www.linkedin.com/in/kasinadhuni-sriya-varshini-114916261/'],
  ['Mamidala Anjali', 'Executive Member', '1J6spp4-x5tb6Pq2BTKYeZTCF1WPUMdmN', 'https://www.linkedin.com/in/anjali-mamidala-a8b424234/'],
  ['Kasireddy Venkata Sai Satya Pawan Kumar', 'Executive Member', '1gu3kfzRlq_m6YQrXw2XqliGZSoYYxMwo', 'https://www.linkedin.com/in/k-v-s-satya-pawan-kumar/'],
  ['Gaurav Chhajed', 'Executive Member', '1JBpvasXfD4Jxqr-SLXhfT40feK37rxxL', 'https://www.linkedin.com/in/gaurav-chhajed/'],
  ['Adithya Venkatesh', 'Executive Member', '18LdysKShwgQUJh0nkYNrz18qIlOFDm6c', 'https://www.linkedin.com/in/artechya/'],
  ['Daksh Rao', 'Executive Member', '1D8RBMQWGc0B64HdnUn6MHh6aV13Uhy8q', 'https://www.linkedin.com/in/daksh-r-72329a137/'],
  ['Soumyadip Das', 'Executive Member', '1CzBgcFVLuwCZhels3qnbmJThVRuaj2cj', ''],
  ['Surojit Das', 'Executive Member', '1EU_hyOY5APdWFrC69SkU-r2l9haC9mb1', 'https://www.linkedin.com/in/surojit-das-b79b77281/'],
  ['Shivam Kumar', 'Executive Member', '1D-T58-uVUvnNUf9PMrRJOf1NxOh6RAmy', 'https://www.linkedin.com/in/shivam-kumar-559417290/'],
  ['Tangirala Jhansi Reddy', 'Executive Member', '19WEDOe0O1tCtlODfkNu7ZTzkb1W7c0yr', 'https://www.linkedin.com/in/jhansireddytangirala/'],
  ['Vinuthna Ronanki', 'Executive Member', '1Dc2xAEbJRkCI2r9L1DyG1HMno_sLXVHs', 'https://www.linkedin.com/in/vinuthna-ronanki-9754012bb/'],
  ['Veerla Jahnavi', 'Executive Member', ''  /* photo link no longer works */, ''],
  ['Shaik Madiha Muskan', 'Executive Member', ''  /* photo link no longer works */, ''],
  ['Vikas Verma', 'Executive Member', ''  /* photo link no longer works */, ''],
];
const LEAD_ROLES = ['Secretary', 'Co-Secretary'];
export const TEAM = TEAM_ROWS.map(([name, role, photo, linkedin], i) => ({
  name,
  role,
  group: role === 'Executive Member' ? 'executive' : 'core',
  is_lead: LEAD_ROLES.includes(role),
  photo_url: drive(photo, 500),
  linkedin,
  sort_order: i,
}));

/* ------------------------------------------------------------------ earlier projects */
export const OLD_PROJECTS = [
  {
    slug: 'robotics-arm',
    title: 'Robotics Arm',
    status: 'completed',
    progress: 100,
    category: 'Robotics',
    summary: 'A simple, versatile robotic arm for pick-and-place and basic automation tasks.',
    image: '19jMp0HrJ60NilyOUaTnML_MUpzNiHzTY',
    image2: '1W89hasGYIw6_4197-QH2vrs47nKqDyKh',
    tech: ['Pick-and-place', 'Automation'],
    body: `In this engaging journey, our club designed, assembled, and operated a simple yet effective robotic arm. Our mission was clear: create a versatile robotic arm capable of performing basic tasks, from pick-and-place operations to automation assistance. Collaborative teamwork was central, with each member contributing their unique skills.

Our project presented challenges, including component selection, assembly precision, and streamlined programming. The robotic arm's debut showcased its simplicity and efficiency. It excelled in various straightforward applications, serving as a foundation for innovation within our club.

Our journey continues as we explore the possibilities of basic robotics, shaping the future of automation.`,
  },
  {
    slug: 'college-chat-bot',
    title: 'Chat Bot',
    status: 'in_progress',
    progress: 10,
    category: 'AI / ML',
    summary: 'An AI chatbot for the college website, built by a first-year team with machine learning and NLP.',
    image: '1lwhwLw2u3JnsO2kpyxfuwNMrE9kf9yTB',
    image2: '',
    tech: ['Python', 'Machine learning', 'Deep learning', 'NLP'],
    body: `The chatbot we are making is a college chatbot. Our college website doesn't have one — that is the motive behind this project.

Our team members are Lokendra, Navya, Shivam, and Jahnavi. All are first-years, and they give their best to the work.

The chatbot is AI based. We are using machine learning, deep learning and NLP to build it, in Python. The bot is adaptable, supporting multiple languages and capable of learning from interactions to improve its performance.

The work is still in progress — about 10% is complete so far, but we expect to make great progress soon.`,
  },
  {
    slug: 'mars-rover',
    title: 'Mars Rover',
    status: 'in_progress',
    progress: null,
    category: 'Robotics',
    summary: 'A versatile, robust rover built to cross rugged terrain — the start of the club’s rover programme.',
    image: '1t3dqNB25LAdViGVzmbjtGEF4er8TqFXo',
    image2: '13Kt1VzFlwHWJqPcAEBrEUpp66eC2NGXR',
    tech: ['Mechanical design', 'Electrical systems', 'Autonomous navigation'],
    body: `Our team is deeply engrossed in a captivating project centered around the development of a cutting-edge rover. This venture underscores our unwavering commitment to pushing the boundaries of technology and exploration, as we endeavor to create a rover capable of navigating diverse and challenging terrains.

Our rover project aspires to craft a versatile, robust rover capable of traversing a spectrum of environments, from rugged Earth landscapes to the potential frontiers of extraterrestrial exploration. The project encompasses meticulous planning, precise engineering, and a deep understanding of the complexities of robotic exploration.

Challenges abound, from mechanical design to electrical systems, autonomous navigation, and scientific instrumentation. Our dedicated team perseveres, addressing each obstacle with creativity and problem-solving acumen, selecting the right components, ensuring robust communication, and advancing autonomous navigation capabilities. Each triumph propels us closer to realizing our vision of pioneering exploration.`,
  },
  {
    slug: 'micro-mouse',
    title: 'Micro Mouse — MazeBlazer',
    status: 'in_progress',
    progress: null,
    category: 'Robotics',
    summary: 'A competitive micromouse robot that solves mazes on its own, from Dijkstra to the Partition Central algorithm.',
    image: '' /* photo link no longer works */,
    image2: '' /* photo link no longer works */,
    tech: ['Arduino Uno R4', 'C++', 'PID control', 'IR sensors', 'N20 motors + encoders'],
    body: `This write-up details the design and development of MazeBlazer, a competitive micromouse robot built to conquer complex mazes autonomously: its hardware, its software, and the ongoing optimization work.

## Hardware: balancing performance and size
- Microcontroller: the Arduino Uno R4 is the central processing unit. Its size and power consumption are not ideal for highly competitive micromice, but it is a friendly platform for early development and algorithm testing. Future versions may move to a lower-power microcontroller with on-board ADCs and PWM outputs.
- Motors and encoders: a pair of N20 DC gear motors gives enough torque while keeping the robot compact. Magnetic encoders on the motor shafts report wheel rotations for accurate distance tracking.
- Sensors: Sharp IR sensors detect walls — affordable and easy to integrate, but sensitive to ambient light. Ultrasonic sensors are a possible upgrade.
- Chassis: a lightweight ABS polymer chassis holds everything while keeping weight low, for faster moves and better solve times.

## Software: the brains behind the maze run
- Language: C++, for efficiency and fine control over hardware peripherals.
- Sensor integration: raw voltage readings from the IR sensors are turned into wall presence and distance, with calibration routines for different lighting.
- Motor control: a PID control loop uses encoder feedback to produce smooth, precise movement.

## Version 1: exploring efficiency with Dijkstra
For the first stage we implemented a variant of Dijkstra's algorithm. It calculates the most efficient connections across the whole maze. It needs the full maze mapped in advance, so it is not suited to real-time competition runs — but it is a solid base for understanding efficient pathfinding, and a benchmark for real-time algorithms.

## Version 2: real-time navigation with Partition Central
Version 2 switches to the Partition Central algorithm, designed for real-time maze exploration.
- Real-time navigation: it guides the robot without pre-exploring, partitioning the maze into smaller sections from sensor data and steering toward the centre of each, eventually reaching the maze centre.
- Adaptability: it adapts to the layout as the robot moves, so it suits different competition mazes.

Dijkstra gives the absolute shortest path through the whole maze; Partition Central favours real-time decisions. Where time limits matter, that can be the more competitive choice even if the path is not always the shortest.

## Continuous improvement
- Sensor testing: rigorous tests with different maze layouts and lighting to find inconsistent readings.
- Algorithm refinement: analysing runs to cut unnecessary turns and reduce solve times.
- Hardware exploration: trying low-power motor drivers better suited to the microcontroller.

MazeBlazer is the result of months of design, development, and testing, pushing miniaturization, sensor integration, and pathfinding. The quest for faster solve times continues.`,
  },
  {
    slug: 'mini-drone',
    title: 'Mini Drone',
    status: 'in_progress',
    progress: null,
    category: 'Aerial',
    summary: 'Mini drones built from scratch around a Raspberry Pi Pico W instead of an off-the-shelf flight controller.',
    image: '' /* photo link no longer works */,
    image2: '' /* photo link no longer works */,
    tech: ['Raspberry Pi Pico W', 'Flight control', 'Embedded'],
    body: `We are building mini drones from scratch using the Raspberry Pi Pico W instead of default mini-drone controllers like the F3 Evo, so that we can add extra functions to the drone in future.

We are studying the Pico W from its basic operations to its complex capabilities, with week-to-week progress toward every operation a drone controller needs to perform.

## Motive
To build a mini drone that can work just like the large drones.

## Why mini drones?
- Mini drones are becoming increasingly popular and can change the way we interact with our environment. Their small size gives a unique view of the world and reaches places that were previously inaccessible.
- They can do tasks that need precision or difficult manoeuvres in tight spaces.
- They are lightweight, portable, and easy to use, and newer technology has made them more efficient, cost-effective, and reliable.
- They can be used for surveillance, mapping, search-and-rescue, and inspection of infrastructure and buildings — including hazardous places where traditional drones are not suitable.

## Where they are used
- Recreation and entertainment: hobby flying, aerial photography, racing.
- Research and development: robotics, surveillance, agriculture, environmental monitoring.
- Military and defence: reconnaissance, surveillance, tactical operations.
- Humanitarian aid: assessing damage, delivering supplies, search and rescue.
- Innovation: pushing aerodynamics, battery technology, and miniaturization forward.`,
  },
];

/* ------------------------------------------------------------------ past events */
export const OLD_EVENTS = [
  {
    id: 'hackademia-2025',
    title: 'Hackademia',
    kind: 'HACKATHON',
    starts_at: '2025-01-24T12:00:00+05:30',
    ends_at: '2025-01-25T12:00:00+05:30',
    venue: 'APJ Abdul Kalam Lab',
    capacity: 100,
    summary: 'A 24-hour Gen AI hackathon on AI for education.',
    link: 'https://unstop.com/hackathons/hackademia-2025-national-institute-of-technology-andhra-pradesh-1337149',
    image: '1D9nVaxcxrqmpyjTkyH4cWb0e64c2PjKi',
    image2: '1ftPyc1TY37Md_31oMZxYGKFgG7lUK6vE',
    body: `A Gen AI hackathon — Gen AI for Education. 24th and 25th January 2025, from 12 noon for 24 hours.

Join innovators, educators, and students to create AI-driven tools that make learning more accessible, engaging, and impactful in today's digital age.

## Event tracks
- Track 1: Language Translation and Localization of Educational Content
- Track 2: Accessible Learning Materials for Students with Disabilities
- Track 3: Smart Flowchart and Diagram Generator

## Event highlights
- Innovative solutions for education: participants tackle real-world challenges in education, creating AI-driven tools that make learning more accessible, engaging, and effective.
- Networking and collaboration: a chance to connect with like-minded innovators and entrepreneurs.
- Hands-on learning: participants develop and present AI solutions, with mentorship from experienced faculty members.
- Showcase talent and creativity: a platform for teams to demonstrate their skills and technical expertise.

## Eligibility
- Open to students and scholars from NIT Andhra Pradesh as well as students from other colleges.
- Teams of 2 to 5 members.
- Teams register through the Unstop link and prepare a 2-slide presentation of their approach.

## Format
- Kickoff and team formation: welcome address, introduction, and an overview of the challenge.
- Hacking phase (24 hours): teams pick a track and develop an AI model for it. Mentors are available throughout. Students stay in the event room, and push their updates to a GitHub repository.
- Model evaluation and pitch preparation: teams evaluate their models' accuracy and performance.

Registration was free.`,
  },
  {
    id: 'nvidia-ml-workshop-2024',
    title: 'Nvidia Workshop — Fundamentals of Machine Learning',
    kind: 'WORKSHOP',
    starts_at: '2024-09-12T09:00:00+05:30',
    venue: 'APJ Abdul Kalam Laboratory Complex',
    capacity: 80,
    summary: 'A comprehensive, hands-on introduction to machine learning with Keras and TensorFlow.',
    image: '1INGIZhIby3gqn0wx9qt0NRIo0EbQjF2k',
    image2: '1cxC684hqul5BdKUKsOE-tb2VIuXxAdXP',
    body: `The Fundamental Machine Learning Workshop, organized by the AI and Robotics Club, is a comprehensive introduction to the world of machine learning. It guides participants through the essential concepts and techniques needed to understand and apply machine learning in various contexts.

## What you'll learn
- Supervised learning: training a model on labeled data, where the algorithm learns from input-output pairs to make predictions on new data.
- Unsupervised learning: working with unlabeled data to find hidden patterns or structures.
- Model evaluation: assessing the performance of models using various metrics, so they are accurate and reliable.
- Feature selection: choosing the most important variables in a dataset — crucial for building efficient models.
- Model deployment: putting machine learning models into real-world applications.
- Algorithm types: including neural networks, the backbone of many modern AI applications.

## Practical experience
Participants don't just learn theory; they get hands-on experience implementing machine learning algorithms with widely used libraries like Keras and TensorFlow.

## Outcome
By the end of the workshop, participants have a solid understanding of machine learning principles and how to apply them to real-world problems, and a foundation for more advanced topics in machine learning and artificial intelligence.`,
  },
  {
    id: 'sih-internal-2024',
    title: 'Smart India Internal Hackathon 2024',
    kind: 'HACKATHON',
    starts_at: '2024-09-09T10:00:00+05:30',
    venue: 'NIT Andhra Pradesh, Tadepalligudem',
    capacity: 80,
    summary: 'The internal selection round for Smart India Hackathon 2024 — top 25 teams go to the national level.',
    image: '1uQ4OClzUu_W92MoWX7AvUJPhf0NruGFH',
    image2: '1gkSvB4RQCV9hZnChwYeFJ1GrmKPqRPC1',
    body: `NIT Andhra Pradesh hosted the Smart India Internal Hackathon (SIH) 2024, part of the world's largest innovation challenge. Initiated by the Government of India, SIH gives students a platform to solve real-world problems for government departments and private organizations.

The Internal Hackathon was the selection event for NIT Andhra Pradesh, with the top 25 teams progressing to the national SIH 2024 competition.

## Event highlights
- Participation certificates for all participants.
- 25 teams selected to represent NIT Andhra Pradesh.
- Teams of 6 members, with at least one female student.
- Each team could submit up to 2 ideas; a student could be part of only one team.
- Only the team leader fills out the entry form.

## Why participate?
- Tackle challenges from government and private sector organizations.
- Improve problem-solving and innovation skills through creative collaboration.
- Present solutions to a panel of experts and receive valuable feedback.

## Process
- In college: the Internal Hackathon was organized by the Innovation & Incubation Centre (IIC), the I&E Cell, and the AIR Club. The SPOC, Dr. Sri Phani Krishna Karri, nominated the best 25 ideas for the SIH 2024 portal.
- Outside college: the Government of India screens the ideas and announces finalists, who receive mentoring and training before the SIH Finale.
- After the finale: winning teams receive funding, a stipend, and support to work on their projects for 6 months.`,
  },
  {
    id: 'recruitment-2024',
    title: 'We Are Hiring — Recruitment Drive 2024',
    kind: 'RECRUITMENT',
    starts_at: '2024-09-09T10:00:00+05:30',
    venue: 'Student Amenity Centre',
    capacity: 198,
    summary: 'How the club recruits: form, shortlisting, technical check, interview, final selection.',
    image: '1Dc6c-SuKYsp4BUOACpGExuMvJ56MtkK1',
    image2: '16nGEwQ5P8A0HZ_bz45na5TJ9MXTkSKZx',
    body: `Are you captivated by the possibilities of Artificial Intelligence and Robotics? Do you dream of building intelligent systems that could revolutionize industries, or robots that can perform complex tasks? Whether you're a beginner just starting out or an expert looking to push the boundaries, our club provides the environment for you to grow and excel.

Our community is more than a collection of students — it's a thriving ecosystem of curious minds dedicated to learning, experimenting, and creating together.

## What we offer
A launchpad for your ideas and a playground for innovation: hands-on projects that range from autonomous robots to intelligent systems.

## Workshops and seminars
We regularly host workshops and seminars led by industry experts and academic leaders. Sessions are interactive, so you not only learn but also apply that knowledge.

## Real-world application
Members take part in national and international competitions and collaborate on ambitious projects. We encourage members to think big, experiment, and take risks.

## Why join us?
You'll connect with peers who share your passion, gain insights from industry experts, and get access to resources that help you grow personally and professionally.

## Application process
- Form submission: fill out the application form with your background, skills, and interests.
- Resume shortlisting: candidates are shortlisted on academic background, relevant skills, and fit with the club's objectives.
- Technical skills check: a brief assessment of your knowledge of AI, robotics, and related technologies.
- Interview call: a conversation about your interests, projects, and ideas.
- Final selection: selected candidates officially become members of the AI and Robotics Club.`,
  },
  {
    id: 'robotics-workshop-nugenix-2024',
    title: 'Robotics Workshop with Nugenix Robotics',
    kind: 'TALK',
    starts_at: '2024-09-05T09:00:00+05:30',
    venue: 'I&E Cell, NIT Andhra Pradesh',
    capacity: 120,
    summary: 'Dr. Aditya Marathe, CEO of Nugenix Robotics, on the impact of robotics in industry.',
    image: '1NfFKHraqXpHnR5YVLOzo276PV8azjTG9',
    image2: '1ZHLLGF5nXtapJl3A01Qrs8yGLt5hPa8o',
    body: `Nugenix, the partner and vendor for Kinova Robotics in India, has made remarkable strides in the field of robotics. They have established comprehensive robotics laboratories in engineering institutions in India and worldwide, including IITs, defence laboratories like DRDO, and corporate sectors.

The AI & Robotics Club at NIT Andhra Pradesh had the distinct honour of hosting Dr. Aditya Marathe, the CEO of Nugenix Robotics. The event, conducted in collaboration with E-Yantra and the E & I Cell, gave Dr. Marathe the opportunity to speak about the transformative impact of robotics in industry, and how Nugenix Robotics helps shape the landscape of robotics technology.`,
  },
  {
    id: 'techkriya-2023',
    title: "Techkriya '23",
    kind: 'COMPETITION',
    starts_at: '2023-11-03T09:00:00+05:30',
    venue: 'MMM Block, NIT Andhra Pradesh',
    capacity: 250,
    summary: 'The club’s events at the annual Techkriya fest: Micro Mouse, robotic-arm Tic Tac Toe, AR Poster and Cube Solving.',
    image: '' /* photo link no longer works */,
    image2: '1ZY7aCJScz8r-yhtg0lr0AfdvpHhptyeL',
    body: `In the dynamic realm of technology and innovation, our AI and Robotics Club took centre stage at the annual Techkriya fest held at our college. The club ran a series of events that captivated tech enthusiasts and pushed the boundaries of what is possible in artificial intelligence and robotics.

Creativity, intellect, and technical skill were on show through four events, each designed to challenge participants: the maze-solving of Micro Mouse, Tic Tac Toe played by a robotic arm, augmented reality in the AR Poster event, and the Cube Solving Algorithm challenge.`,
  },
  {
    id: 'colloquium-2023',
    title: "Colloquium '23",
    kind: 'SHOWCASE',
    starts_at: '2023-09-15T09:00:00+05:30',
    venue: 'NIT Andhra Pradesh, Tadepalligudem',
    capacity: 71,
    summary: "An Engineers' Day showcase of research through poster presentations and oral discussions.",
    image: '1quFQv6Xn2evRHXlBc32dH2oQ4zL_ovT-',
    image2: '1TXTlADFEsYZht_7d1gJyau8U0Va053Vq',
    body: `Colloquium '23, held on September 15, 2023, at the National Institute of Technology Andhra Pradesh, exceeded all expectations with an immense turnout of participants. The event, dedicated to Engineers' Day, witnessed an inspiring display of research and innovation from passionate scholars.

Through poster presentations and interactive oral discussions, Colloquium '23 gave participants a platform to showcase their work and build connections within the engineering community.

We extend our heartfelt thanks to all participants, faculty, and the organizing committee for contributing to the event's success.`,
  },
  {
    id: 'fundamentals-of-deep-learning',
    title: 'Fundamentals of Deep Learning',
    kind: 'WORKSHOP',
    starts_at: '2022-01-01T10:00:00+05:30',
    venue: 'NIT Andhra Pradesh, Tadepalligudem',
    capacity: 80,
    summary: 'A deep learning workshop for 80 selected participants, led by DLI Ambassador Dr. Sri Phani Krishna Karri.',
    image: '1FSG6YuRdt2VHhEE0ITfQlguLfCu2Ecbl',
    image2: '1cjeYO64KQsOClyKn9fW6mEtPMBrwQyS9',
    body: `With a remarkable response of 164 applicants, we conducted a rigorous selection process, choosing 80 participants who demonstrated outstanding enthusiasm and promising potential.

Guiding us on this journey was our DLI Ambassador, Dr. Sri Phani Krishna Karri. His expertise and passion made the session a dynamic and thought-provoking experience. The workshop became a vibrant hub for exchanging knowledge and developing valuable skills.

We owe a heartfelt thank you to Dr. K. Himabindu, Head of the Department of Computer Science and Engineering at NIT Andhra Pradesh. Her support, with the provision of lab facilities and logistical assistance, played a pivotal role in making this event a success.

This workshop was a testament to the collaborative spirit and dedication of all involved, and an inspiration for future endeavours.`,
  },
];

/* ------------------------------------------------------------------ Techkriya competitions (shown on the Techkriya '23 page) */
export const TECHKRIYA = [
  ['Micro Mouse', 'A robot solves a maze and optimizes the best route.', 'M6 6h12v12H6zM6 12h6M12 6v6M12 18v-3M15 9h3'],
  ['Line Follower Competition', 'Participants present their custom-built line follower robots to compete.', 'M4 18c4 0 4-12 8-12s4 12 8 12M10 12h4'],
  ['Autonomous Drone', 'A quadcopter fitted with AI capabilities.', 'M12 12l-6-6M12 12l6-6M12 12l-6 6M12 12l6 6M4 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  ['Mini Drone', 'Drones navigate closed environments using sensors.', 'M12 12l-5-4M12 12l5-4M5 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 16h6'],
  ['Robotic Arm', 'A 5-DOF robotic arm replicates human arm movements.', 'M5 20h6M8 20V12l5-5 5 3M13 7l-2-3M18 10l2 2'],
  ['Jungle Safari', 'Any character you draw on a piece of paper can be scanned.', 'M5 5h14v14H5zM9 14c1 2 5 2 6 0M9 10h.01M15 10h.01'],
];

/* ------------------------------------------------------------------ Learn page: videos */
export const VIDEO_GROUPS = [
  ['initial', 'Start here', 'Five short videos that explain the basics.'],
  ['recent', 'In the news', 'Talks and stories about where AI is going.'],
  ['extra', 'Go deeper', 'Visual explanations of how neural networks and transformers work.'],
  ['course', 'Full courses', 'Complete Stanford lecture series, free on YouTube.'],
];
// [group, title, YouTube id]
export const VIDEOS = [
  ['initial', 'What is Artificial Intelligence?', 'c0m6yaGlZh4'],
  ['initial', 'What is Machine Learning?', '9gGnTQTYNaE'],
  ['initial', 'How deep learning is different?', 'q6kJ71tEYqM'],
  ['initial', 'What is Natural Language Processing?', 'fLvJ8VdHLA0'],
  ['initial', 'What is Generative AI?', 'pWNAtUwnBS8'],
  ['recent', 'Artificial intelligence comes to farming in India | BBC News', 'JeU_EYFH1Jk'],
  ['recent', 'Andrew Ng: Opportunities in AI - 2023', '5p248yoa3oE'],
  ['recent', 'Google CEO Sundar Pichai and the Future of AI | The Circuit', '5puu3kN9l7c'],
  ['recent', 'AI art, explained', 'SVcsDDABEkM'],
  ['extra', 'But what is a neural network?', 'aircAruvnKk'],
  ['extra', 'Gradient descent, how neural networks learn', 'IHZwWFHWa-w'],
  ['extra', 'But what is a GPT? Visual intro to transformers', 'wjZofJX0v4M'],
  ['extra', 'Attention in transformers, visually explained', 'eMlx5fFNoYc'],
  ['course', 'Stanford CS229: Machine Learning Course', 'jGwO_UgTS7I'],
  ['course', 'Stanford CS230: Deep Learning | Autumn 2018', 'PySo_6S4ZAg'],
  ['course', 'Stanford CS224N NLP with Deep Learning', 'LWMzyfvuehA'],
  ['course', 'Stanford CS234: Reinforcement Learning', 'FgzM3zpZ55o'],
];
