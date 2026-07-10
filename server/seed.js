// Seed data generator. Produces the initial database when no db.json exists.

let counter = 1;
const uid = (prefix) => `${prefix}_${(counter++).toString(36)}${Date.now().toString(36).slice(-4)}`;

export const USERS = [
  { id: 'u1', name: 'Ahsan Nawazish', initials: 'AN', color: '#0073ea' },
  { id: 'u2', name: 'Sofia Martinez', initials: 'SM', color: '#a25ddc' },
  { id: 'u3', name: 'David Chen', initials: 'DC', color: '#00c875' },
  { id: 'u4', name: 'Priya Sharma', initials: 'PS', color: '#e2445c' },
  { id: 'u5', name: 'Tom Becker', initials: 'TB', color: '#fdab3d' },
  { id: 'u6', name: 'Lena Fischer', initials: 'LF', color: '#66ccff' },
];

const STAGE_LABELS = [
  { id: 'new', text: 'New', color: '#c4c4c4' },
  { id: 'discovery', text: 'Discovery', color: '#66ccff' },
  { id: 'proposal', text: 'Proposal', color: '#a25ddc' },
  { id: 'negotiation', text: 'Negotiation', color: '#fdab3d' },
  { id: 'won', text: 'Won', color: '#00c875' },
  { id: 'lost', text: 'Lost', color: '#e2445c' },
];

const LEAD_STATUS_LABELS = [
  { id: 'newlead', text: 'New lead', color: '#579bfc' },
  { id: 'contacting', text: 'Attempting contact', color: '#fdab3d' },
  { id: 'qualified', text: 'Qualified', color: '#00c875' },
  { id: 'unqualified', text: 'Unqualified', color: '#e2445c' },
];

const CONTACT_TYPE_LABELS = [
  { id: 'customer', text: 'Customer', color: '#00c875' },
  { id: 'prospect', text: 'Prospect', color: '#579bfc' },
  { id: 'partner', text: 'Partner', color: '#a25ddc' },
];

export const PRIORITY_LABELS = [
  { id: 'critical', text: 'Critical ⚠', color: '#333333' },
  { id: 'high', text: 'High', color: '#401694' },
  { id: 'medium', text: 'Medium', color: '#5559df' },
  { id: 'low', text: 'Low', color: '#579bfc' },
];

export const DEFAULT_STATUS_LABELS = [
  { id: 'done', text: 'Done', color: '#00c875' },
  { id: 'working', text: 'Working on it', color: '#fdab3d' },
  { id: 'stuck', text: 'Stuck', color: '#e2445c' },
];

const item = (name, values) => ({ id: uid('item'), name, values });

function salesPipelineBoard() {
  const cols = {
    owner: { id: 'owner', title: 'Owner', type: 'person' },
    stage: { id: 'stage', title: 'Stage', type: 'status', labels: STAGE_LABELS },
    value: { id: 'value', title: 'Deal value', type: 'number', unit: '$' },
    close: { id: 'close', title: 'Close date', type: 'date' },
    priority: { id: 'priority', title: 'Priority', type: 'status', labels: PRIORITY_LABELS },
  };
  return {
    id: 'board_sales',
    name: 'Sales Pipeline',
    description: 'Track deals from first call to close',
    columns: Object.values(cols),
    groups: [
      {
        id: uid('grp'), title: 'Active deals', color: '#579bfc', collapsed: false,
        items: [
          item('Acme Corp — Enterprise plan', { owner: 'u1', stage: 'negotiation', value: 48000, close: '2026-07-24', priority: 'high' }),
          item('Globex renewal + upsell', { owner: 'u2', stage: 'proposal', value: 21500, close: '2026-08-02', priority: 'medium' }),
          item('Initech pilot program', { owner: 'u3', stage: 'discovery', value: 9800, close: '2026-08-15', priority: 'low' }),
          item('Umbrella Health — 200 seats', { owner: 'u4', stage: 'proposal', value: 62000, close: '2026-07-30', priority: 'critical' }),
          item('Stark Industries integration', { owner: 'u1', stage: 'discovery', value: 15400, close: '2026-09-01', priority: 'medium' }),
        ],
      },
      {
        id: uid('grp'), title: 'Closing this month', color: '#00c875', collapsed: false,
        items: [
          item('Wayne Enterprises — annual', { owner: 'u5', stage: 'negotiation', value: 87000, close: '2026-07-18', priority: 'critical' }),
          item('Hooli starter package', { owner: 'u2', stage: 'won', value: 5400, close: '2026-07-11', priority: 'low' }),
          item('Pied Piper — compression suite', { owner: 'u6', stage: 'negotiation', value: 33000, close: '2026-07-28', priority: 'high' }),
        ],
      },
      {
        id: uid('grp'), title: 'Closed', color: '#c4c4c4', collapsed: false,
        items: [
          item('Soylent Corp trial', { owner: 'u3', stage: 'lost', value: 12000, close: '2026-06-20', priority: 'medium' }),
          item('Massive Dynamic — platform', { owner: 'u1', stage: 'won', value: 154000, close: '2026-06-28', priority: 'critical' }),
        ],
      },
    ],
  };
}

function leadsBoard() {
  return {
    id: 'board_leads',
    name: 'Leads',
    description: 'Incoming leads and qualification',
    columns: [
      { id: 'owner', title: 'Owner', type: 'person' },
      { id: 'status', title: 'Status', type: 'status', labels: LEAD_STATUS_LABELS },
      { id: 'company', title: 'Company', type: 'text' },
      { id: 'email', title: 'Email', type: 'text' },
      { id: 'last', title: 'Last contact', type: 'date' },
    ],
    groups: [
      {
        id: uid('grp'), title: 'New leads', color: '#579bfc', collapsed: false,
        items: [
          item('Maria Gonzalez', { owner: 'u2', status: 'newlead', company: 'Vertex Labs', email: 'maria@vertexlabs.io', last: '2026-07-09' }),
          item('James Okafor', { owner: 'u1', status: 'contacting', company: 'Northwind Traders', email: 'j.okafor@northwind.com', last: '2026-07-08' }),
          item('Yuki Tanaka', { owner: 'u5', status: 'newlead', company: 'Sakura Digital', email: 'yuki@sakuradigital.jp', last: '2026-07-10' }),
        ],
      },
      {
        id: uid('grp'), title: 'In progress', color: '#fdab3d', collapsed: false,
        items: [
          item('Omar Haddad', { owner: 'u3', status: 'qualified', company: 'Atlas Freight', email: 'omar@atlasfreight.co', last: '2026-07-05' }),
          item('Emma Lindqvist', { owner: 'u4', status: 'contacting', company: 'Fjord Analytics', email: 'emma@fjord.se', last: '2026-07-02' }),
        ],
      },
      {
        id: uid('grp'), title: 'Archived', color: '#c4c4c4', collapsed: true,
        items: [
          item('Carl Reyes', { owner: 'u6', status: 'unqualified', company: 'Reyes Consulting', email: 'carl@reyesconsulting.com', last: '2026-06-12' }),
        ],
      },
    ],
  };
}

function contactsBoard() {
  return {
    id: 'board_contacts',
    name: 'Contacts',
    description: 'Everyone we know, in one place',
    columns: [
      { id: 'owner', title: 'Owner', type: 'person' },
      { id: 'type', title: 'Type', type: 'status', labels: CONTACT_TYPE_LABELS },
      { id: 'company', title: 'Company', type: 'text' },
      { id: 'email', title: 'Email', type: 'text' },
      { id: 'phone', title: 'Phone', type: 'text' },
    ],
    groups: [
      {
        id: uid('grp'), title: 'Key accounts', color: '#a25ddc', collapsed: false,
        items: [
          item('Bruce Wayne', { owner: 'u5', type: 'customer', company: 'Wayne Enterprises', email: 'bruce@wayne.com', phone: '+1 (555) 010-2288' }),
          item('Richard Hendricks', { owner: 'u6', type: 'customer', company: 'Pied Piper', email: 'richard@piedpiper.com', phone: '+1 (555) 014-9901' }),
          item('Walter Bishop', { owner: 'u1', type: 'partner', company: 'Massive Dynamic', email: 'walter@massivedynamic.com', phone: '+1 (555) 019-3321' }),
        ],
      },
      {
        id: uid('grp'), title: 'Prospects', color: '#579bfc', collapsed: false,
        items: [
          item('Gavin Belson', { owner: 'u2', type: 'prospect', company: 'Hooli', email: 'gavin@hooli.com', phone: '+1 (555) 016-7745' }),
          item('Pepper Potts', { owner: 'u1', type: 'prospect', company: 'Stark Industries', email: 'pepper@stark.com', phone: '+1 (555) 011-8890' }),
        ],
      },
    ],
  };
}

export function seedDatabase() {
  return {
    users: USERS,
    boards: [salesPipelineBoard(), leadsBoard(), contactsBoard()],
  };
}
