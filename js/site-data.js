/* Written by tools/build.py from data/site.json. Do not edit: change site.json and run the build. */
window.SITE = {
  "_how_to": "Everything on the website that may change lives in this file. After changing it, run: python3 website/tools/build.py (it writes the pages again from tools/pages, so the site is right for search engines, for people without JavaScript and when opened from disk). An empty value means 'not decided yet': the pages say so in plain words and never invent one. A plan whose price is null shows 'Price announced soon' and a 'Talk to us' button. Plans with ai_included true are the main cards; a plan with ai_included false is shown as the quieter option under them. Prices are rupees before GST: price_monthly and price_yearly for the monthly / yearly switch; price_once, on a plan that can also be bought with one payment (today only own-key), adds an 'Or pay once' row to that card and a 'Pay once' choice on the buy page. A licence bought once does not expire and includes a year of support and updates; leave price_once out of a plan that cannot be bought once. A plan with hosted true runs on our servers (today every plan with AI included; the free trial and the Own AI key plan run on the customer's own computer): its card lists its features, and its list \"different\" says plainly what is not the same as on a computer of your own. When every such plan has the same \"different\" list it is shown once, under the cards; otherwise each card shows its own. A hosted plan cannot be paid once. The amount charged is set on the licence server: keep the two the same. status_url is the public status page on the licence server (for example <api_base>/status): while it is empty, the footer and the Help page simply do not mention it.",
  "name": "Work Sailor",
  "employee_name": "Myra",
  "tagline": "Your digital employee, on WhatsApp.",
  "promise": "She does the work, you stay in charge.",
  "domain": "https://worksailor.in",
  "support_email": "support@worksailor.in",
  "support_whatsapp": "",
  "api_base": "https://licence.worksailor.in",
  "status_url": "https://licence.worksailor.in/status",
  "trial_days": 14,
  "terms_version": "draft-1",
  "downloads": {
    "windows": "https://licence.worksailor.in/download/windows",
    "mac": "https://licence.worksailor.in/download/mac"
  },
  "payments": {
    "provider": "Razorpay",
    "methods": "UPI or card"
  },
  "price_note": "plus GST where it applies",
  "plans": [
    {
      "id": "starter",
      "name": "Starter",
      "blurb": "For a lighter workload.",
      "price_monthly": 19999,
      "price_yearly": 199990,
      "currency": "INR",
      "ai_included": true,
      "allowance": "About 1,500 replies and 15 website tasks a month",
      "hosted": true,
      "features": [
        "We run her on our servers, day and night",
        "We set her up with you",
        "We keep her updated and backed up",
        "Nothing to install: your team opens her dashboard in a browser"
      ],
      "different": [
        "Your company’s chats, files and everything she knows are stored on our servers, not on a computer of yours.",
        "Our support staff can sign in to her dashboard to help. Every sign-in shows in your activity, and you can switch it off.",
        "A website’s “I am not a robot” check cannot be handed to a person, so she cannot finish a site that insists on one.",
        "The free trial runs on your own computer. When you buy one of these plans, we move her to our servers: we write to you to do it."
      ],
      "highlight": false
    },
    {
      "id": "team",
      "name": "Team",
      "blurb": "For a team that asks her things every day.",
      "price_monthly": 49999,
      "price_yearly": 499990,
      "currency": "INR",
      "ai_included": true,
      "allowance": "About 3,500 replies and 40 website tasks a month",
      "hosted": true,
      "features": [
        "We run her on our servers, day and night",
        "We set her up with you",
        "We keep her updated and backed up",
        "Nothing to install: your team opens her dashboard in a browser"
      ],
      "different": [
        "Your company’s chats, files and everything she knows are stored on our servers, not on a computer of yours.",
        "Our support staff can sign in to her dashboard to help. Every sign-in shows in your activity, and you can switch it off.",
        "A website’s “I am not a robot” check cannot be handed to a person, so she cannot finish a site that insists on one.",
        "The free trial runs on your own computer. When you buy one of these plans, we move her to our servers: we write to you to do it."
      ],
      "highlight": true
    },
    {
      "id": "business",
      "name": "Business",
      "blurb": "For a company that leans on her all day.",
      "price_monthly": 99999,
      "price_yearly": 999990,
      "currency": "INR",
      "ai_included": true,
      "allowance": "About 7,000 replies and 80 website tasks a month",
      "hosted": true,
      "features": [
        "We run her on our servers, day and night",
        "We set her up with you",
        "We keep her updated and backed up",
        "Nothing to install: your team opens her dashboard in a browser"
      ],
      "different": [
        "Your company’s chats, files and everything she knows are stored on our servers, not on a computer of yours.",
        "Our support staff can sign in to her dashboard to help. Every sign-in shows in your activity, and you can switch it off.",
        "A website’s “I am not a robot” check cannot be handed to a person, so she cannot finish a site that insists on one.",
        "The free trial runs on your own computer. When you buy one of these plans, we move her to our servers: we write to you to do it."
      ],
      "highlight": false
    },
    {
      "id": "own-key",
      "name": "Own AI key",
      "blurb": "For a company that already has an Anthropic API account.",
      "price_monthly": 14999,
      "price_yearly": 149990,
      "price_once": 399000,
      "currency": "INR",
      "ai_included": false,
      "allowance": "No monthly limit from us. You pay your AI provider directly for what she uses.",
      "features": [],
      "highlight": false
    }
  ],
  "every_plan": [
    "Everything she can do: answers, standing orders, documents, website tasks, approvals",
    "One digital employee: on our servers with AI included, or on one office computer, Windows or Mac, with your own AI key",
    "Your company’s data stays yours: never sold, shared or used to train AI",
    "Updates for as long as you subscribe"
  ],
  "company": {
    "legal_name": "",
    "address": "",
    "email": "support@worksailor.in",
    "governing_law": "",
    "courts": ""
  },
  "social": {
    "linkedin": "",
    "x": "",
    "instagram": "",
    "youtube": ""
  },
  "buying_open": false
};
