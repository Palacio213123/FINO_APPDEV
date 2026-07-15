export interface EduQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface EduTopic {
  id: string;
  title: string;
  tabLabel: string;
  icon: string;
  summary: string;
  lesson: string[];
  quiz: EduQuizQuestion[];
}

export const FINANCIAL_EDUCATION_TOPICS: EduTopic[] = [
  {
    id: 'budgeting',
    title: 'Budgeting',
    tabLabel: 'Budget',
    icon: 'pie-chart-outline',
    summary: 'Give every peso a job before you spend it.',
    lesson: [
      'A budget is simply a plan for where your money goes each month — before you spend it, not after.',
      'Try the 50/30/20 rule: 50% of income on needs (rent, food, bills), 30% on wants (eating out, hobbies), and 20% on savings or debt payoff.',
      "List your fixed costs first (rent, subscriptions, loan payments) — these rarely change month to month, so they're the easiest to plan around.",
      'Track every expense for at least two weeks. Most people underestimate small, frequent purchases like coffee or ride-hailing far more than big ones.',
      'Use categories (food, transport, bills, shopping) so you can see which area is quietly eating your budget, not just your total spend.',
      "Review and adjust monthly. A budget that doesn't match reality after a few months isn't a failure — it just needs updating.",
      "Leave a small buffer (5-10%) for irregular costs like gifts or repairs, so one surprise expense doesn't blow up your whole plan.",
    ],
    quiz: [
      {
        question: 'What does the 50/30/20 rule mainly help you divide?',
        options: [
          'Your monthly income into needs, wants, and savings',
          'Your grocery list into categories',
          'Your work hours into tasks',
          'Your bank accounts into currencies',
        ],
        correctIndex: 0,
      },
      {
        question: 'Which of these is a "need" rather than a "want"?',
        options: [
          'Streaming subscriptions',
          'Rent or housing payment',
          'Concert tickets',
          'New gadgets',
        ],
        correctIndex: 1,
      },
      {
        question: 'Why should you track your expenses for a couple of weeks?',
        options: [
          'To impress your bank',
          "It's required by law",
          'To see your real spending patterns',
          'To qualify for a loan',
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: 'saving',
    title: 'Saving',
    tabLabel: 'Saving',
    icon: 'shield-checkmark-outline',
    summary: 'Build a cushion before you need one.',
    lesson: [
      'An emergency fund covers unexpected costs — medical bills, job loss, urgent repairs — without forcing you into debt.',
      "Aim to save 3-6 months' worth of essential expenses. Start with a smaller goal like one month if that feels far off.",
      'Keep it somewhere safe and easy to access, like a separate savings account — not tied up in investments that can drop in value when you need cash most.',
      'Automate a small transfer to savings every payday. Consistency beats waiting for "extra" money, which rarely shows up on its own.',
      "Separate emergency savings from goal-based savings (like a trip or gadget fund) so you're not tempted to raid one for the other.",
      'Every time you get a raise or bonus, save a portion of it immediately before your spending habits adjust upward to match.',
      'Re-evaluate your target once or twice a year — as your expenses grow, your emergency fund goal should grow with them.',
    ],
    quiz: [
      {
        question: 'What is the main purpose of an emergency fund?',
        options: [
          'To buy investments quickly',
          'To cover unexpected expenses without debt',
          'To pay for vacations',
          'To increase your credit score',
        ],
        correctIndex: 1,
      },
      {
        question:
          'How many months of expenses should an emergency fund typically cover?',
        options: ['3–6 months', '1 day', '10 years', "It doesn't matter"],
        correctIndex: 0,
      },
      {
        question: "What's a good way to build savings consistently?",
        options: [
          'Wait until you have extra cash left over',
          'Automate transfers on payday',
          'Only save once a year',
          'Borrow money to save',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'debt',
    title: 'Debt & Credit',
    tabLabel: 'Debt',
    icon: 'card-outline',
    summary: 'Borrow with a plan, not by accident.',
    lesson: [
      '"Good debt" (like a mortgage, student loan, or business loan) can build long-term value; "bad debt" (like high-interest credit card debt) mostly drains your money.',
      'Paying only the minimum on a credit card can take years — sometimes decades — to clear the balance because interest keeps compounding on what remains.',
      'Your credit score reflects how reliably you repay borrowed money. Paying on time, every time, is the single biggest factor in keeping it healthy.',
      'Keeping your credit card balance low relative to your limit (your "utilization") also helps your score, even if you pay in full each month.',
      "Avoid borrowing to cover everyday expenses like groceries or rent — that's usually a sign your budget needs adjusting, not that you need a loan.",
      "If you're juggling multiple debts, tackle either the highest-interest one first (saves the most money) or the smallest balance first (builds momentum) — pick whichever keeps you motivated.",
      'Before taking on new debt, always ask: what is this actually for, and do I have a realistic plan to pay it back on schedule?',
    ],
    quiz: [
      {
        question: 'What generally makes debt "bad debt"?',
        options: [
          'It builds long-term value',
          'It carries high interest and funds things that lose value',
          "It's used for education",
          'It has no interest at all',
        ],
        correctIndex: 1,
      },
      {
        question: 'What happens if you only pay the minimum on a credit card?',
        options: [
          'You pay it off faster',
          'Interest is waived',
          'It can take years to pay off due to interest',
          'Your limit increases automatically',
        ],
        correctIndex: 2,
      },
      {
        question: 'What mainly affects your credit score?',
        options: [
          "Your favorite bank's logo",
          'How reliably you repay on time',
          'How many apps you have installed',
          'Your job title',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'banking',
    title: 'Banking & E-Wallets',
    tabLabel: 'Banking',
    icon: 'phone-portrait-outline',
    summary: 'Know where your money actually lives.',
    lesson: [
      "A savings account earns a little interest and is best for money you don't need for daily spending.",
      'E-wallets like GCash or Maya are great for convenience and instant transfers, but treat the balance like cash — it usually earns no interest sitting there.',
      'Always enable two-factor authentication (2FA) on banking and e-wallet apps, and never share your OTP (one-time PIN) with anyone, even someone claiming to be "support."',
      'Check for hidden fees on transfers, withdrawals, and cash-ins before relying on a single app — small per-transaction fees add up fast if you use them often.',
      'Spreading money across a couple of trusted institutions (one bank, one e-wallet) reduces risk if one has an outage or account issue.',
      'Set up transaction notifications so you notice unauthorized activity immediately, not weeks later when reviewing a statement.',
      'Before linking a new account or wallet to any app, confirm the app is official and reputable — a huge share of financial fraud starts with fake apps or phishing links.',
    ],
    quiz: [
      {
        question:
          "Compared to e-wallets, what's a key benefit of a savings account?",
        options: [
          'It usually earns interest on your balance',
          'It can only be used online',
          'It has no security',
          'It requires no ID to open',
        ],
        correctIndex: 0,
      },
      {
        question:
          'What should you never share to protect your e-wallet account?',
        options: [
          'Your favorite color',
          'Your OTP (one-time PIN)',
          'Your username',
          'Your profile photo',
        ],
        correctIndex: 1,
      },
      {
        question:
          'Before relying on one banking app or e-wallet, what should you check?',
        options: [
          'Its app icon design',
          'Hidden fees on transfers and withdrawals',
          'How many friends use it',
          'Nothing, all apps are the same',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'investing',
    title: 'Investing',
    tabLabel: 'Invest',
    icon: 'trending-up-outline',
    summary: 'Make your money grow, not just sit.',
    lesson: [
      'Investing means putting money to work — in things like stocks, mutual funds, or index funds — so it can grow over time, unlike savings, which mainly protects it.',
      'Compounding rewards time: you earn returns not just on your original money, but on the returns it already made. Starting early, even with small amounts, matters more than starting big later.',
      'Higher potential returns usually come with higher risk. Match your investments to your goals and timeline — money needed in 1 year should sit somewhere safer than money needed in 20.',
      'Never invest money you might need within the next 1-2 years; a market dip right when you need cash can lock in real losses.',
      'Diversify instead of betting on one asset — spreading money across different investments smooths out the ups and downs of any single one.',
      'Fees matter more than they seem. A fund charging 2% a year versus 0.5% can mean a meaningfully smaller nest egg decades later, even with identical returns.',
      "You don't need to be an expert to start — low-cost index funds let beginners get broad, diversified exposure without picking individual stocks.",
    ],
    quiz: [
      {
        question: 'What is "compounding" in investing?',
        options: [
          'Losing money over time',
          'Earning returns on both your original money and previous gains',
          'A type of bank fee',
          'A government tax',
        ],
        correctIndex: 1,
      },
      {
        question: 'Why does starting to invest early matter?',
        options: [
          "It doesn't matter at all",
          'Compounding has more time to grow your money',
          'Early investors get free money from the government',
          'Markets only go up early in the year',
        ],
        correctIndex: 1,
      },
      {
        question: "What's a generally sound investing principle?",
        options: [
          'Put all your money into one stock',
          'Diversify and avoid investing money you need soon',
          'Invest your emergency fund for higher returns',
          'Ignore your risk tolerance',
        ],
        correctIndex: 1,
      },
    ],
  },
];
