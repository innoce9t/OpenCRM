// Seed data generator. Produces the initial database when no db.json exists.
import { hashPassword } from './auth.js';

let counter = 1;
const uid = (prefix) => `${prefix}_${(counter++).toString(36)}${Date.now().toString(36).slice(-4)}`;

// Demo accounts share the password below so the seeded app is immediately usable.
export const DEMO_PASSWORD = 'opencrm';
const withPw = (u, role, pw = DEMO_PASSWORD) => {
  const { salt, hash } = hashPassword(pw);
  return { ...u, email: u.email || `${u.name.split(' ')[0].toLowerCase()}@opencrm.app`, role, pwSalt: salt, pwHash: hash };
};

export const USERS = [
  withPw({ id: 'u1', name: 'Ahsan Nawazish', initials: 'AN', color: '#0073ea' }, 'admin'),
  withPw({ id: 'u2', name: 'Sofia Martinez', initials: 'SM', color: '#a25ddc' }, 'member'),
  withPw({ id: 'u3', name: 'David Chen', initials: 'DC', color: '#00c875' }, 'member'),
  withPw({ id: 'u4', name: 'Priya Sharma', initials: 'PS', color: '#e2445c' }, 'member'),
  withPw({ id: 'u5', name: 'Tom Becker', initials: 'TB', color: '#fdab3d' }, 'member'),
  withPw({ id: 'u6', name: 'Lena Fischer', initials: 'LF', color: '#66ccff' }, 'guest'),
];

export function seedWorkspaces(users = USERS) {
  return [{ id: 'ws_main', name: 'Main workspace', color: '#0073ea', memberIds: users.map((u) => u.id) }];
}

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
  { id: 'critical', text: 'Critical', color: '#333333' },
  { id: 'high', text: 'High', color: '#401694' },
  { id: 'medium', text: 'Medium', color: '#5559df' },
  { id: 'low', text: 'Low', color: '#579bfc' },
];

export const DEFAULT_STATUS_LABELS = [
  { id: 'done', text: 'Done', color: '#00c875' },
  { id: 'working', text: 'Working on it', color: '#fdab3d' },
  { id: 'stuck', text: 'Stuck', color: '#e2445c' },
];

export const DEFAULT_DROPDOWN_LABELS = [
  { id: 'opt1', text: 'Option 1', color: '#579bfc' },
  { id: 'opt2', text: 'Option 2', color: '#a25ddc' },
  { id: 'opt3', text: 'Option 3', color: '#00c875' },
];

export function defaultSubitemColumns() {
  return [
    { id: 'sub_owner', title: 'Owner', type: 'person' },
    { id: 'sub_status', title: 'Status', type: 'status', labels: JSON.parse(JSON.stringify(DEFAULT_STATUS_LABELS)) },
    { id: 'sub_due', title: 'Due', type: 'date' },
  ];
}

const item = (name, values, extra = {}) => ({
  id: uid('item'), name, values, updates: [], subitems: [], ...extra,
});

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

// The AI assistant's identity for chat authorship (not a real team member).
export const AI_USER = { id: 'ai', name: 'OpenCRM AI', initials: 'AI', color: '#6c5ce7', bot: true };

export function defaultQuickReplies() {
  return [
    'On it',
    'Thanks!',
    'Can you share more details?',
    "I'll follow up by EOD.",
    'Looks good to me',
    'Let’s hop on a quick call.',
  ];
}

const msg = (userId, type, text, extra = {}) => ({
  id: uid('msg'), userId, type, text: text || '', attachments: [], mentions: [], at: new Date().toISOString(), ...extra,
});

export function seedChannels(users = USERS) {
  const everyone = users.map((u) => u.id);
  return [
    {
      id: 'ch_general', type: 'group', name: 'general', description: 'Company-wide chatter', members: everyone,
      messages: [
        msg('u2', 'text', 'Morning team! Kicking off the Acme negotiation today.'),
        msg('u1', 'text', 'Nice. I pulled the deal into the pipeline — see the card.', {
          type: 'task', taskRef: { boardId: 'board_sales', itemName: 'Acme Corp — Enterprise plan' },
        }),
        msg('u3', 'text', 'Ping me if you need the security docs.', { mentions: ['u1'] }),
      ],
    },
    {
      id: 'ch_announce', type: 'broadcast', name: 'announcements', description: 'Read-only broadcasts to the whole company', members: everyone,
      messages: [
        msg('u1', 'text', 'Q3 kickoff is Monday 10am. Attendance expected for all of sales.'),
      ],
    },
    {
      id: 'ch_design', type: 'group', private: true, name: 'design-team', description: 'Private design squad', members: [users[1]?.id, users[3]?.id, users[5]?.id].filter(Boolean),
      messages: [
        msg(users[1]?.id || 'u2', 'text', 'New brand palette is up for review.'),
      ],
    },
    {
      id: 'ch_dm_u1_u2', type: 'dm', name: '', description: '', members: [users[0]?.id, users[1]?.id].filter(Boolean),
      messages: [
        msg(users[1]?.id || 'u2', 'text', 'Hey — do you have the Acme numbers handy?'),
        msg(users[0]?.id || 'u1', 'text', 'Yep, sending them over now.'),
      ],
    },
    {
      id: 'ch_ai', type: 'ai', name: 'ai-assistant', description: 'Ask about your tasks, deals, and deadlines', members: everyone,
      messages: [
        msg('ai', 'ai', 'Hi! I can answer questions about your boards. Try: “how many deals are in negotiation?”, “what’s assigned to me?”, or “what’s overdue?”'),
      ],
    },
  ];
}

export function seedDatabase() {
  const boards = [salesPipelineBoard(), leadsBoard(), contactsBoard()];
  for (const b of boards) {
    b.subitemColumns = defaultSubitemColumns();
    b.automations = b.automations || [];
    b.views = [];
    b.activity = [];
    b.workspaceId = 'ws_main';
    b.sharedWith = [];
  }

  // A little demo collaboration + automation so the app isn't empty on features.
  const sales = boards[0];
  const firstDeal = sales.groups[0].items[0];
  firstDeal.updates = [
    { id: uid('upd'), userId: 'u2', text: 'Sent the revised proposal, waiting on legal.', mentions: ['u1'], at: '2026-07-09T14:20:00.000Z' },
    { id: uid('upd'), userId: 'u1', text: 'Thanks @Sofia Martinez — I’ll chase procurement.', mentions: ['u2'], at: '2026-07-10T09:05:00.000Z' },
  ];
  firstDeal.subitems = [
    { id: uid('sub'), name: 'Security review', values: { sub_owner: 'u3', sub_status: 'working', sub_due: '2026-07-16' } },
    { id: uid('sub'), name: 'Legal redlines', values: { sub_owner: 'u4', sub_status: 'stuck', sub_due: '2026-07-14' } },
  ];
  sales.automations = [
    {
      id: uid('auto'), enabled: true,
      trigger: { columnId: 'stage', labelId: 'won' },
      action: { type: 'notify', userId: '__owner' },
    },
  ];

  return {
    users: USERS, boards, notifications: [], channels: seedChannels(USERS),
    quickReplies: defaultQuickReplies(), workspaces: seedWorkspaces(USERS), sessions: {},
  };
}
