// Entregas de ejemplo (Secretariado bilingüe). Las dos cartas comparten párrafos para
// demostrar el detector de plagio; el memo contiene frases típicas de texto generado por IA.

export interface SampleSubmission {
  studentName: string;
  assignmentTitle: string;
  fileName: string;
  text: string;
}

const p = (...paras: string[]) => paras.join('\n\n');

export const SAMPLE_SUBMISSIONS: SampleSubmission[] = [
  {
    studentName: 'Valeria Gómez',
    assignmentTitle: 'Business letter: quotation request',
    fileName: 'valeria_gomez_business_letter.txt',
    text: p(
      'Valeria Gómez\nAdministrative Assistant\nGrupo Industrial Aurora\nAv. Reforma 245, Mexico City',
      'November 10, 2026',
      'Mr. Robert Hayes\nSales Manager\nOffice Solutions Inc.\n1200 Market Street, San Antonio, TX',
      'Subject: Request for a quotation of office supplies',
      'Dear Mr. Hayes:',
      'I am writing on behalf of Grupo Industrial Aurora to request a formal quotation for office supplies for our administrative department. Our company is planning its purchases for the first quarter of next year, and we would like to compare prices and delivery conditions before we place an order.',
      'We are interested in the following items: 40 boxes of letter-size paper, 25 ink cartridges for laser printers, 60 ring binders and 15 ergonomic desk chairs. Please include unit prices, available discounts for large orders and the estimated delivery time to Mexico City.',
      'We would appreciate it if you could send the quotation to my email address before November 25. If you need additional information, please do not hesitate to contact me by phone at 55 1234 5678 during office hours.',
      'Thank you for your attention. We look forward to establishing a long and productive business relationship with your company.',
      'Sincerely,',
      'Valeria Gómez\nAdministrative Assistant',
    ),
  },
  {
    studentName: 'Luis Hernández',
    assignmentTitle: 'Business letter: quotation request',
    fileName: 'luis_hernandez_business_letter.txt',
    text: p(
      'Luis Hernández\nExecutive Assistant\nComercializadora del Bajío\nBlvd. López Mateos 1020, León, Guanajuato',
      'November 11, 2026',
      'Ms. Karen Mitchell\nCustomer Service Director\nGlobal Office Supply Co.\n455 Commerce Avenue, Houston, TX',
      'Subject: Quotation for office equipment',
      'Dear Ms. Mitchell:',
      'My name is Luis Hernández, and I work as an executive assistant at Comercializadora del Bajío. I am contacting you because our office needs new supplies and equipment, and your company was recommended to us by one of our business partners.',
      'We are interested in the following items: 40 boxes of letter-size paper, 25 ink cartridges for laser printers, 60 ring binders and 15 ergonomic desk chairs. Please include unit prices, available discounts for large orders and the estimated delivery time to Mexico City.',
      'I would be grateful if you could reply before the end of the month. If you need additional information, please do not hesitate to contact me by phone at 47 7890 1234 during office hours.',
      'Thank you for your attention. We look forward to establishing a long and productive business relationship with your company.',
      'Best regards,',
      'Luis Hernández\nExecutive Assistant',
    ),
  },
  {
    studentName: 'Mariana López',
    assignmentTitle: 'Formal email: day-off request',
    fileName: 'mariana_lopez_formal_email.txt',
    text: p(
      'To: Human Resources Department\nSubject: Request for a day off on December 5',
      'Dear Ms. Ramírez,',
      'I hope you are doing well. I am writing to ask for permission to take a day off on Friday, December 5. I have a medical appointment in Puebla that morning, and the trip does not allow me to return to the office the same day.',
      'Before I leave, I will finish the monthly expense report and update the meeting calendar for the following week. My colleague, Andrea Torres, has kindly agreed to answer phone calls and check the general inbox while I am away. She knows our filing system well, so nothing urgent should be delayed.',
      'Please let me know if I need to fill out a formal request form or if there is any other procedure I should follow. I can also make up the hours on another day if necessary, for example by staying late on Wednesday or Thursday.',
      'Thank you in advance for your understanding.',
      'Kind regards,',
      'Mariana López\nReceptionist, Grupo Industrial Aurora\nExt. 214',
    ),
  },
  {
    studentName: 'Andrés Morales',
    assignmentTitle: 'Internal memo: digital filing system',
    fileName: 'andres_morales_memo.txt',
    text: p(
      'MEMORANDUM',
      'To: All administrative staff\nFrom: Andrés Morales, Office Coordinator\nDate: November 12, 2026\nSubject: Implementation of a digital filing system',
      "In today's fast-paced world, effective document management plays a crucial role in the success of any organization. It is important to note that our current paper-based filing system no longer meets the needs of our growing team. Therefore, this memo aims to delve into the benefits of adopting a digital filing system.",
      'Furthermore, a digital system will allow employees to locate documents seamlessly and securely. Moreover, it will foster collaboration between departments and streamline daily administrative tasks. Additionally, it will reduce printing costs and support our commitment to sustainability.',
      'It is worth noting that digital tools are a testament to the ever-evolving landscape of modern office work. According to recent research, organizations that digitize their records save a significant amount of time on routine searches (Johnson, 2023). Furthermore, a robust digital archive serves as a reliable foundation for future growth.',
      'In conclusion, embracing this change will unlock the potential of our team and elevate the quality of our services. It is important to note that training sessions will be scheduled during the first week of December. Moreover, all staff members are encouraged to share their questions with the coordination office.',
      'References',
      'Johnson, M. (2023). Digital transformation in administrative offices. Business Press.',
    ),
  },
  {
    studentName: 'Fernanda Cruz',
    assignmentTitle: 'Meeting minutes: monthly administrative meeting',
    fileName: 'fernanda_cruz_meeting_minutes.txt',
    text: p(
      'Minutes of the Monthly Administrative Meeting',
      'Date: November 7, 2026\nTime: 10:00 a.m. to 11:15 a.m.\nLocation: Conference Room B, Grupo Industrial Aurora\nChair: Laura Méndez, Administrative Manager\nSecretary: Fernanda Cruz',
      'Attendees: Laura Méndez, Jorge Salinas, Patricia Ortega, Ricardo Fuentes and Fernanda Cruz. Absent: Sofía Navarro (excused).',
      '1. Approval of the previous minutes. The minutes of the October meeting were read and approved without changes.',
      '2. Office supply budget. Jorge Salinas reported that the department has already spent 85 percent of its quarterly budget. He suggested that every request for new supplies should be approved by the manager before any purchase. All attendees accepted the proposal.',
      '3. Year-end event. Patricia Ortega presented two options for the end-of-year celebration. After a short discussion, the team chose the restaurant because it is closer to the office and fits the budget.',
      '4. Visitor registration. Ricardo Fuentes explained that reception will start using a digital log for visitors next week. Everyone agreed to tell their clients about the change.',
      'Agreements: Fernanda Cruz will send the updated supply request form to all staff by November 10. Patricia Ortega will confirm the restaurant reservation by November 14.',
      'The meeting was adjourned at 11:15 a.m. The next meeting will be held on December 5, 2026.',
      'Fernanda Cruz\nSecretary',
    ),
  },
];
