# Saylani / SMIT Portal — Complete Product & Engineering Report

**Product:** Saylani Mass IT Training Management, Donor Visibility & AI Analytics Portal<br>
**Report date:** 10 September 2026<br>
**Language:** Roman Urdu with English technical terminology<br>
**Scope:** Product overview, existing modules, implemented improvements, problems and solutions, architecture, technology, data, AI, testing, limitations aur next steps.

Yeh report current local source code, project review, saved evaluation files aur is development session mein ki gayi changes par based hai. Historical test numbers ko aaj ke live database totals ya guaranteed performance na samjha jaye. Is documentation task mein production deployment, fresh security audit ya tamam user journeys ka dobara live test nahi kiya gaya.

API keys, database connection passwords aur login passwords jaan-boojh kar is shareable report mein include nahi kiye gaye.

## Contents

1. Product basically kya hai?
2. Business problem aur intended value
3. Users aur access model
4. Existing product modules
5. Humne is development phase mein kya improve kiya?
6. Problem → solution → current status
7. Technical architecture
8. Tech stack
9. Database model aur important definitions
10. AI ka complete working flow
11. Model selection aur latency improvements
12. Automatic charts aur visualization intelligence
13. Dashboard customization
14. Authentication, privacy aur safeguards
15. Testing aur measured results
16. Known limitations aur pending engineering work
17. Local setup aur operational configuration
18. Deployment readiness aur roadmap
19. Project structure aur source references
20. Demo flow, success metrics aur presentation summary

---

## 1. Product basically kya hai?

Yeh ek web-based management aur analytics portal hai jo SMIT ke training operations ko ek jagah present karta hai. Is mein campuses, students, enrolments, trainers, courses, classes, attendance, student fee payments aur donation-related information ko role ke mutabiq dekha ja sakta hai.

Product ka AI layer, **Saylani Intelligence**, users ko natural language mein data samajhne mein help karta hai. User ko MongoDB query likhna zaroori nahi: woh sawal poochta hai, AI authorized tools ke zariye relevant data nikalta hai, result explain karta hai aur zaroorat par interactive chart banata hai.

Is product ko teen connected parts mein samjha ja sakta hai:

- **Management portal:** Organization ki existing training information, lists, detail pages aur selected data-entry workflows.
- **Visibility portal:** Donors aur trainers ko unke role ke mutabiq relevant overview.
- **AI analytics workspace:** Questions, evidence-based explanations, automatically suggested visuals aur personalized dashboard charts.

Repository ka naam donor end-to-end system hai, lekin current implementation ko complete donation-payment platform kehna accurate nahi hoga. Donor visibility aur donation records ke modules maujood hain; online payment checkout aur complete donor transaction-management journey source review mein nahi mili.

## 2. Business problem aur intended value

Organization ka data multiple related collections mein hota hai. Sirf records available hone se decision-making automatically easy nahi hoti. Kisi manager ko yeh samajhna ho ke kis campus mein enrolments zyada hain, fees ka pattern kya hai, ya different courses ka comparison kya banta hai, tou raw records se jawab nikalna waqt leta hai.

Is product ka intended value yeh hai:

| Business need | Product ka response |
| --- | --- |
| Organization ka consolidated overview | Admin dashboard aur operational modules |
| Technical query ke baghair analysis | Natural-language AI assistant |
| Numbers ko samajhna | Charts, tables aur simple explanations |
| Relevant information tak role-based access | Admin, trainer aur donor interfaces |
| Repeated analysis ko easily dekhna | AI chart ko main dashboard par save karna |
| Missing data ki wajah samajhna | Limitation aur required records/fields explain karna |
| Dashboard par kaam karte hue AI use karna | Compact right-side chatbot widget |

Yeh expected business benefits hain. User productivity, adoption ya administrative cost savings ka formal measurement abhi record nahi hua; isliye unke percentage claims nahi kiye gaye.

## 3. Users aur access model

### Admin

Admin organization-level dashboard, operational records, selected data-entry forms, reports aur AI assistant use karta hai. Admin role ke liye recognized admin accounts `users` collection se authenticate hote hain. Har record-management capability ko universal CRUD support na samjhein: available forms aur AI tools ke mutabiq selected actions implemented hain.

### Trainer

Trainer ko personal dashboard, assigned campus/course/student information aur AI assistant milta hai. Authentication `trainers` collection se hoti hai. Trainer queries ko assigned data tak scope karne ke controls hain; unknown ya safely scope na hone wali collections refuse ki jati hain.

### Donor

Donor organization impact aur campus/classroom activity dekh sakta hai. Portal donor accounts `portal_donors` mein store hote hain. Signup donor role ke liye available hai. Current chat endpoint admin aur trainer roles ko allow karta hai; donor ko AI access available samajhna sahi nahi.

## 4. Existing product modules

Yeh modules supplied application ka hissa the. Is development phase mein poora portal zero se create nahi kiya gaya; existing system ka analysis karke uske AI, database connection aur dashboard behavior ko improve kiya gaya.

| Module | Current purpose |
| --- | --- |
| Authentication | Role-based login, donor signup, session handling aur logout |
| Admin overview | Campuses, enrolments, trainers, courses, classes aur fee-related overview |
| Campuses | Campus listing aur detail information |
| Students | Student/enrolment records, filters aur detail pages |
| Trainers | Trainer listing aur detail information |
| Courses / classes | Course offerings aur scheduled class visibility |
| Attendance | Attendance-related records aur analytics |
| Fee payments | Student tuition/payment information |
| Donations / donors | Fundraising records aur donor visibility |
| Success stories | Existing success-story presentation |
| Data entry | Selected campus, trainer, course, student aur class creation forms |
| AI assistant | Data questions, supported actions, conversations aur charts |
| Reports | Word report generation aur sponsorship PDF export |
| Voice | Browser speech features aur optional ElevenLabs text-to-speech |
| Theme / responsive UI | Theme controls aur multiple screen sizes ke liye layout |

Reports, voice aur har operational module ka complete end-to-end revalidation recent chart tests ka hissa nahi tha. Feature ka source mein hona aur uska production-ready verified hona alag cheezen hain.

## 5. Humne is development phase mein kya improve kiya?

Development ka focus progressively user experience aur dependable analytics par shift hua:

1. Project ka structure aur existing problems review kiye; local application run ki.
2. Dashboard ke right side par AI launcher aur compact chatbot panel add kiya.
3. Chatbot ka fullscreen / collapse behavior implement kiya.
4. Real MongoDB connection configure aur data access verify kiya.
5. AI provider integration, tool execution aur evidence-based answering improve ki.
6. Interactive, query-backed charts aur conversation persistence add ki.
7. Separate AI-chart section ki initial implementation ko user feedback ke mutabiq remove kiya.
8. Original aur AI charts ko ek editable main dashboard layout mein integrate kiya.
9. Slow model ordering aur repeated waits ko optimize kiya.
10. Automatic visualization behavior ko keyword matching se aage improve kiya.
11. Targeted tests aur evaluation artifacts add kiye.

User ne product direction aur acceptance criteria diye: compact widget, real-data answers, helpful limitations, charts without explicitly asking, dashboard replacement aur lower latency. Implementation aur verification is development session mein us direction ke mutabiq ki gayi.

## 6. Problem → solution → current status

| Problem / requirement | Implemented solution | Status / qualification |
| --- | --- | --- |
| AI use karne ke liye dedicated page par jana parta tha | Main dashboard par right-side Ask AI widget | Implemented |
| Chat kholne se dashboard context lose hota tha | Large desktop par approximately 25vw panel; smaller screens par responsive width | Implemented; exact quarter-width har screen par nahi |
| Detailed chat ke liye zyada space chahiye tha | Fullscreen aur collapse buttons | Implemented |
| Local Atlas SRV DNS lookup fail ho rahi thi | Equivalent Atlas host-list connection with TLS aur replica-set configuration | Local connection verified |
| Failed database connection promise reuse hoti thi | Failure par cached connection promise reset | Implemented |
| AI kabhi unsupported figures ya data assumptions deta tha | Evidence instructions, scoped tools, successful-read checks aur safer query validation | Improved; zero hallucination guarantee nahi |
| Students aur enrolments ko same samjha ja sakta tha | Exact separate counts aur explicit labels | Implemented |
| Static schema estimates stale ho sakte the | Live sampled fields/statuses aur real queries | Implemented; sampling complete schema proof nahi |
| Empty approximate collection count real data hide kar sakta tha | Static zero shortcut remove; actual collection query | Implemented |
| Generic query filters unsafe ya invalid ho sakte the | Scalar filters, allowed-field checks aur private-collection restrictions | Implemented for AI query path |
| Charts sirf text/image hote tou reusable nahi hote | Typed chart objects rendered as SVG/table | Implemented |
| Model invented chart numbers de sakta tha | Server charts ko current-turn query evidence se construct karta hai | Implemented |
| Separate AI chart section flexible nahi tha | Main dashboard mein shared original + AI chart layout | Implemented |
| Existing chart replace ya delete nahi hota tha | Drop-to-replace, insertion, reorder aur delete controls | Implemented |
| Layout refresh ke baad lose ho sakta tha | Owner-specific MongoDB persistence with revision checks | Integration-tested |
| Answers bohat late aa rahe the | Groq-first ordering; provider budget 20 seconds; slow repeat retries removed | Live samples mein major improvement |
| User ko har dafa chart explicitly mangna parta tha | Semantic instructions, aggregate-result hints aur final usefulness assessment | Positive aur text-only negative tests pass |
| Missing answer ke badle guess mil sakta tha | Missing fields, relationships aur data requirements explain karne ki instructions | Improved; model assertions still need review |

## 7. Technical architecture

Application ek **single Next.js project** hai. UI aur backend API routes isi repository aur runtime mein hain; separate Express backend ya Python model server current architecture ka hissa nahi.

```text
User browser
  |
  +-- Next.js pages + React components
  |      +-- Admin / Trainer / Donor interfaces
  |      +-- AI widget and assistant page
  |      +-- Interactive chart components
  |
  +-- Next.js server routes / data services
         +-- Authentication and role checks
         +-- Management reads and selected writes
         +-- AI orchestration engine
         |      +-- Groq / Gemini provider adapter
         |      +-- Authorized database tools
         |      +-- Query evidence -> chart validation
         |
         +-- MongoDB Atlas
                +-- Existing business collections
                +-- Conversations and AI chart artifacts
                +-- Per-user dashboard layout
                +-- Report storage
```

Important boundary: LLM ko unrestricted database administrator ki tarah direct MongoDB access nahi diya gaya. Model structured tool calls propose karta hai; server allowed tools execute karta hai. Allowed query results model provider ko explanation banane ke liye bheje jate hain. Isliye external AI processing ko data-flow ka actual hissa samajhna chahiye.

## 8. Tech stack

Versions neeche `package.json` declarations ko represent karte hain; caret versions installed lockfile version ka exact claim nahi hain.

| Layer | Technology / declared version | Use |
| --- | --- | --- |
| Full-stack framework | Next.js 16.2.10, App Router | Pages, route handlers, server rendering aur build |
| UI | React / React DOM 19.2.4 | Components, state aur interactions |
| Language | TypeScript ^5 | Shared interfaces aur compile-time checks |
| Styling | Tailwind CSS ^4 | Responsive styling aur design tokens |
| Animation | Framer Motion ^12.42.2 | UI motion |
| Icons | Lucide React ^1.23.0 | Controls aur visual icons |
| Database | MongoDB Atlas + mongodb ^7.5.0 | Operational data aur application persistence |
| Password hashing | bcryptjs ^3.0.3 | Password verification/storage hashing |
| JWT | jose ^6.2.3 | Signed sessions aur verification |
| Runtime validation | Zod ^4.4.3 | Request bodies aur chart schemas |
| AI primary | Groq, openai/gpt-oss-120b | Low-latency reasoning/tool calling |
| AI fallback | Gemini, gemini-3.6-flash | Alternative provider on primary failure |
| Provider transport | Server-side fetch, OpenAI-compatible chat interface | Structured messages aur tool calls |
| AI text rendering | react-markdown ^10.1.0, remark-gfm ^4, remark-breaks ^4 | Markdown responses |
| Chart rendering | Custom React + SVG | Real bar, line, area, pie aur diagram/table views |
| Drag/drop | Browser DataTransfer API | Chart movement aur replacement |
| Word export | docx ^9.7.1 | Generated Word reports |
| PDF export | pdfkit ^0.19.1 | Sponsorship PDF |
| Configuration | dotenv ^17.4.2 / Next environment loading | Server-side environment variables |
| Tooling | ESLint ^9, tsx ^4.23.0, React Compiler plugin | Checks, scripts aur compilation |

Current charts ke liye Chart.js/Recharts dependency use nahi ho rahi. Current AI solution mein custom-trained neural network, Python training pipeline, vector database ya embeddings-based RAG pipeline implement nahi ki gayi.

## 9. Database model aur important definitions

### Core entities

| Collection / concept | Meaning |
| --- | --- |
| `students` | Individual student profiles |
| `student_inductions` | Course enrolments; ek person ke multiple records ho sakte hain |
| `campus` | Campus information |
| `cities` | Campus location references |
| `trainers` | Trainer records aur trainer authentication fields |
| `courses` | Course catalog |
| `new_courses` | Actual course offering / batch |
| `slots` | Scheduled class/slot information |
| `payments` | Student tuition/fee payment domain |
| `donations`, `campaigns` | Charity/fundraising domain |
| `jobs` | Job postings; confirmed graduate placements ka equivalent nahi |

```text
Student profile
  -> one or more enrolments
       -> campus
       -> catalog course
       -> course offering / batch
       -> trainer
       -> optional class slot
```

Names kuch records mein bilingual `en` / `ur` structures mein stored hain. Relationships mein string IDs aur ObjectIds dono mil sakte hain, isliye joins aur mappings mein normalization important hai.

### App-owned persistence

| Collection | Purpose |
| --- | --- |
| `users` | Admin account lookup |
| `portal_donors` | Portal donor accounts |
| `revoked_sessions` | Logged-out session identifiers |
| `agent_conversations` | Owner-based chat history with chart references/specs |
| `portal_ai_charts` | Validated chart artifact, owner, source query aur timestamp |
| `portal_chart_boards` | Per-user layout order aur revision |
| GridFS report collections | Generated report storage |

### Historical verification snapshot

Earlier live verification mein 102 student profiles, 114 enrolments, 7 campuses, 9 trainers, 107 payments aur 0 donation records observe huay. Yeh test-time facts hain, hardcoded business totals nahi.

Campus comparison example mein 61, 36, 6, 4, 4, 2 aur 1 enrolments mile, total 114. Six records ka campus unset tha; unhein kisi known campus ke naam par assign karke chart ko artificially clean nahi kiya gaya.

## 10. AI ka complete working flow

### Training aur configuration ka farq

Model ko user database par fine-tune nahi kiya gaya. Uske weights update nahi huay. Product-specific behavior prompts, role context, database tools, schemas, validation aur evaluations ke zariye configure hua.

Is approach ka practical faida yeh hai ke current answer ke liye current data query kiya ja sakta hai. Database update hone par dobara model training karna zaroori nahi. Lekin saved chart snapshots automatically refresh nahi hote.

### Question se answer tak

1. User assistant ko message bhejta hai.
2. `/api/chat` authentication, allowed role aur message format validate karta hai.
3. Server user role/context aur recent conversation ke saath system instructions prepare karta hai.
4. Initial tool selection relevant tools ko expose karti hai; har request mein tamam tool definitions nahi bheji jatin.
5. Model read/analysis tool choose karta hai ya genuinely ambiguous request par clarification poochta hai.
6. Server arguments parse aur tool authorization check karta hai.
7. MongoDB query ya specialized aggregation execute hoti hai.
8. Successful result ko current-turn evidence ID milti hai.
9. Chartable aggregate data ke saath visualization hint attach ho sakti hai.
10. Model evidence explain karta hai, zaroorat ho tou chart tool invoke karta hai.
11. Chart server actual evidence fields se plotted values nikalta hai.
12. Answer/charts conversation history mein save hote hain aur browser mein render hote hain.

Tool rounds bounded hain: current engine up to eight rounds aur each round mein up to eight calls handle karta hai. Calls sequential hain, taa-ke dependent reads/writes ki ordering preserve ho. Yeh loop complex tasks ko support karta hai, lekin har extra round latency add karta hai.

### Important tool families

- `get_org_stats`: Organization-level exact totals.
- `describe_schema`: Collection discovery aur relevant schema information.
- `query_collection`: Validated generic reads, grouping aur count-only behavior.
- `analyze_enrolments`: Campus/course/status/time-based enrolment analysis.
- Fee, donation, attendance aur academic analytics tools.
- `enable_tools`: Additional allowed specialized capabilities expose karna.
- `create_chart`: Successful current-turn evidence se chart banana.
- Selected admin mutation/report tools: Role aur supported action ke mutabiq.

### Missing-data answer ka correct behavior

Agar sawal ho "Placed graduates ki average salary kya hai?", job vacancies ki salary ranges ko graduates ki actual salaries assume nahi karna chahiye. Answer ko verified placement link, actual earned salary, currency aur monthly/annual period ki zaroorat explain karni chahiye.

Schema discovery sampled aur partly curated hai. Sirf collection names dekh kar tamam fields ke absent hone ka universal claim valid nahi. Instructions improve ki gayi hain, lekin saved outputs mein kabhi model inspected evidence se zyada broad language use karta hai; yeh remaining quality issue hai.

## 11. Model selection aur latency improvements

Initial evaluation mein Gemini ke answers comparatively reliable the, jabke Groq fast hone ke bawajood ek unsupported placement assumption aur ek HTTP 413 case dikha raha tha. Is basis par pehle Gemini primary rakha gaya.

Baad mein user feedback ne latency ko clear product problem identify kiya. Slow response path mein 45-second model waits aur repeated attempts delay ko barha sakte the. Changes ke baad:

- Groq GPT-OSS 120B default primary hai.
- Gemini Flash fallback hai, jab uski credential configured ho.
- `AI_PRIMARY_PROVIDER` ordering change kar sakta hai.
- Each provider request ka shared 20-second budget alternate keys ko bhi cover karta hai.
- Timeout/server error par wohi slow request dobara retry nahi hoti.
- Authentication/quota-related failures par available alternate credential try ho sakti hai.
- Cancellation par unnecessary next-provider attempt avoid hota hai.
- Existing data evidence aur chart validation controls retain kiye gaye.

20 seconds poore answer ki guarantee nahi: ek task mein multiple provider/tool rounds ho sakte hain. Likewise fallback configured hone ka matlab unlimited quota nahi. Earlier Pro evaluation mein zero quota tha aur ek Gemini variant ki daily allowance exhaust hui thi; yeh historical API observations hain.

## 12. Automatic charts aur visualization intelligence

AI ab sirf "chart banao" phrase ka wait nahi karta. Instructions sawal ke meaning aur returned data ko dekh kar visual decide karne ko kehti hain.

| Question / data need | Suitable presentation |
| --- | --- |
| Campuses ya courses ka comparison | Bar chart |
| Monthly enrolments / fee changes | Line chart |
| Time ke saath volume ka pattern | Area / wave view |
| Known total ke few mutually exclusive parts | Pie / circle chart |
| Exact individual values | Table |
| Simple category/sequence overview | Limited flow-style diagram; causal proof nahi |
| Ek total, greeting ya missing-data explanation | Usually plain text |

Implementation mein aggregate rows ke liye candidate label aur numeric fields identify hote hain. Multiple dated labels time-series suggestion dete hain. Missing numeric values, duplicate labels, single-row results aur arbitrary raw personal records automatically chart suggestions receive nahi karte.

Hints advisory hain: model ko relevance, coverage aur user preference judge karni hoti hai. Final response se pehle ek additional assessment missed visualization ko catch kar sakti hai. User explicitly text-only kahe tou us preference ko respect karna chahiye.

Charts ke safety rules mein current-turn evidence reference, actual numeric values, unique labels, maximum row limit aur valid pie distribution shamil hain. Single answer mein maximum three charts allowed hain. Chart renderer screenshot/image nahi; underlying data-driven UI hai.

## 13. Dashboard customization

Initial design mein "Your AI charts" naam ka separate section tha. User ne clarify kiya ke AI charts existing dashboard ka direct hissa hone chahiye. Final implementation ne separate section remove kar diya.

Current interactions:

- Chat chart ka grip dashboard par drag karna.
- Existing chart ke center par drop: destination chart replace hota hai.
- Charts ke darmiyan insertion area par drop: baqi charts preserve rehte hain aur naya chart insert hota hai.
- Existing original ya AI chart ko move karna.
- Har chart ke delete control se dashboard placement remove karna.
- Position dropdown se keyboard/touch-friendly reordering.
- Pin se chart ko main layout ke end par add karna.
- Fullscreen widget drag start par collapse ho kar dashboard reachable karta hai.

Layout per account save hota hai. Revision checks simultaneous tabs ke stale changes ko silently overwrite karne se bachate hain. Replacement dashboard placement ko change karti hai; original database records delete nahi hote. AI chart artifact conversation mein reh sakta hai.

Current freedom responsive grid ke order ke andar hai, arbitrary X/Y pixel positioning ya har page element ka canvas editor nahi. Up to 100 charts layout mein supported hain. Chart view type ka local change original saved artifact type ko permanently update nahi karta.

## 14. Authentication, privacy aur safeguards

Implemented protections mein password hashing, signed sessions, role-specific portal paths, HTTP-only session cookie, API authorization, owner-specific chart access aur validated AI tool calls shamil hain.

AI generic query path private system collections ko deny karta hai; trainer reads safely scope na ho sakein tou refuse hoti hain. User messages system-role messages ke taur par forge karke submit nahi kiye ja sakte. Chart values model-supplied arbitrary numbers se accept nahi hotin.

Yeh safeguards complete security certification nahi. Existing review mein session revocation boundaries, application rate limiting, multi-record writes aur destructive confirmation ke issues mile the. Neeche unka remaining status diya gaya hai. Shareable documentation mein operational secrets include nahi kiye gaye.

## 15. Testing aur measured results

### Recorded performance samples

| Test | Observed time | Meaning |
| --- | --- | --- |
| Earlier Gemini campus chart | Approximately 89.7 seconds | Historical full chart workflow |
| Groq-first explicit campus chart | 10.6 seconds | Query, chart, explanation aur persisted conversation verified |
| Exact student/enrolment counts | 2.2 seconds | 102 / 114 matched historical live data |
| Missing salary-data explanation | 5.1 seconds | Read-backed limitation response; not a full factuality score |
| Vague chart clarification | 0.87 seconds | Model asked for required preferences |
| Implicit campus comparison | 5.8 seconds | User ne chart nahi manga; chart khud generate hua |
| Explicit text-only preference | 4.2 seconds | No chart generated |

Yeh small samples hain, controlled repeated benchmark ya P95 SLA nahi. Different questions, schema calls, context size, provider quota aur server cold start timings change kar sakte hain. Initial evaluation mein Roman Urdu prompt ka English response bhi observe hua; consistent language matching abhi perfect nahi.

### Verification coverage

| Check | Recorded outcome / scope |
| --- | --- |
| TypeScript | Recent implementation checks pass |
| ESLint | Recent implementation checks pass |
| Production build | Dashboard-layout phase mein pass; AVIF optimization warning observed |
| Current-turn chart provenance | Invalid result IDs, fields aur types rejected |
| Live chart workflow | Exact total, chart creation aur history persistence verified |
| Main dashboard layout | Original/AI replace, insert, move, remove aur reload verified |
| Access isolation | Other-owner chart access aur invalid roles rejected |
| Concurrency | Stale layout revision rejected |
| Provider failover | Primary ordering, shared deadline, failover aur cancellation checks pass |
| Visualization policy | Aggregate/time suggestions; unsuitable shapes excluded |
| Automatic visuals | Positive implicit-request aur negative text-only tests pass |

Recent automatic-visualization changes ke baad TypeScript/lint aur targeted live tests run huay. Har subsequent change ke baad full production build rerun hone ka claim nahi kiya ja raha.

Browser checks earlier isolated chart rendering tak huay. Final integrated dashboard ka complete authenticated drag/drop visual walkthrough automation timeout ki wajah se pending raha. API/layout tests aur successful server response browser interaction testing ka complete replacement nahi hain.

Test fixtures dedicated temporary owners use karte hain aur cleanup karte hain. Source business records ko chart tests ke liye alter nahi kiya gaya.

## 16. Known limitations aur pending engineering work

### Production-critical review findings

| Finding | Current assessment / next action |
| --- | --- |
| Revoked session access | Proxy signature/expiry/role check karta hai, revocation nahi. Relevant server data boundaries par consistent revocation enforcement review/fix chahiye. |
| Revocation-store failure | Existing verifier database failure par fail-open behavior rakhta hai; production policy decide aur implement karni hai. |
| Form fields not persisted | Kuch accepted campus/trainer/course/class fields inserts mein omitted hain; schema-to-storage mapping complete karni hai. |
| Related writes not atomic | Student + enrolment aur course + offering writes mein transaction/idempotency work pending hai. |
| Foreign-key correctness | Submitted references ki existence aur relationship validation strengthen karni hai. |
| Trainer onboarding | Form-created trainer ke liye password/invitation journey incomplete hai. |
| Destructive AI confirmation | Prompt-level confirmation server-enforced approval token ka substitute nahi; destructive actions ka protocol pending hai. |
| Login/signup abuse controls | Application-level rate limiting aur duplicate-email race prevention review pending hai. |

### Quality and scale limitations

- Current AI is configured, not fine-tuned; factual, language aur visualization-choice mistakes possible hain.
- Data-question evidence gate heuristics use karta hai; universal semantic guarantee nahi.
- Schema sampling complete absence proof nahi deta.
- Saved charts query snapshots hain; realtime subscriptions nahi.
- Fixed status-derived attendance/progress values existing code review mein mile; measured outcomes ki tarah present karne se pehle audit chahiye.
- Large lists, frequent refresh aur growing chat documents scale par performance issues create kar sakte hain.
- Report expiry metadata/chunk cleanup aur expired-download behavior review chahiye.
- Dependency audit mein earlier issues report huay the; current advisory status is report ke liye dobara verify nahi hua.
- Historical README/review/deployment instructions mein outdated provider, Git aur setup claims hain. Current source ko priority dein.
- General-purpose diagrams, multi-axis analytics, forecasting aur arbitrary canvas placement implemented capabilities nahi samjhi jani chahiye.

## 17. Local setup aur operational configuration

Project folder ek single Next.js application hai. Existing local preview address `http://127.0.0.1:3001` hai; woh sirf running local server ko point karta hai, public deployment nahi.

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Development machine ke supported Node runtime aur lockfile ko use karein. Production mein exact runtime compatibility verify karke pin karna behtar operational step hai.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Server-side database connection |
| `AUTH_JWT_SECRET` | Session signing secret |
| `GROQ_API_KEY` | Primary AI credential |
| `GROQ_API_KEY_2` | Optional alternate credential |
| `GROQ_MODEL` | Groq model override |
| `GEMINI_API_KEY` | Fallback credential |
| `GEMINI_API_KEY_2` | Optional alternate Gemini credential |
| `GEMINI_MODEL` | Gemini model override |
| `AI_PRIMARY_PROVIDER` | Provider ordering; default Groq |
| `ELEVENLABS_API_KEY` | Optional voice synthesis |

`.env.local` local secret configuration hai; report ya public repository mein values copy na karein. `.env.example` names/placeholders provide karta hai, lekin uske kuch descriptive comments provider ordering se outdated ho sakte hain.

Useful checks:

```powershell
npm run lint
npx tsc --noEmit
npm run build
$env:TEST_BASE_URL='http://127.0.0.1:3001'
npm run test:agent-live
npx tsx --env-file=.env.local scripts/test-dashboard-layout.ts
npx tsx --env-file=.env.local scripts/test-auto-visualization.ts
npx tsx scripts/test-visualization-policy.ts
npx tsx scripts/test-provider-failover.ts
```

Live AI tests external provider quota consume karte hain aur temporary application documents create/clean karte hain. Seed/security scripts account records change kar sakte hain; routine startup ke liye unhein run karna zaroori nahi.

## 18. Deployment readiness aur roadmap

Current report public deployment completion certify nahi karti. Folder mein deployment guide maujood hai, lekin uske GitHub/hosting claims independently verified nahi huay; current local folder mein `.git` metadata bhi nahi mila.

Deployment planning ke waqt single Next.js application, MongoDB connectivity, server-side secrets, AI provider availability aur request-duration support verify karne honge. Existing guide ki "allow access from anywhere" instruction ko universal requirement na samjhein; database network access hosting architecture aur supported egress arrangement ke mutabiq configure hoti hai. Is report mein hosting account, network allowlist ya public access change nahi ki gayi.

Suggested next phases:

1. **Data correctness and access:** Revocation boundaries, persisted form fields, foreign keys aur destructive-action protocol resolve karein.
2. **Release verification:** Fresh build, current dependency review, all-role login aur actual browser workflows verify karein.
3. **Staging:** Environment configuration, database access, provider limits aur report/voice behavior test karein.
4. **Production operations:** Monitoring, error visibility, backup/recovery, account provisioning aur rollback procedure establish karein.
5. **Further product work:** Chart refresh controls, larger multilingual evaluations, better pagination aur measured analytics data add karein.

Yeh roadmap proposed work hai; ise completed implementation mein count nahi kiya gaya.

## 19. Project structure aur source references

| Path | Responsibility |
| --- | --- |
| `app/auth/` | Login/signup UI |
| `app/portal/admin/` | Admin modules |
| `app/portal/trainer/` | Trainer dashboard/assistant |
| `app/portal/donor/` | Donor overview |
| `app/api/auth/` | Authentication endpoints |
| `app/api/chat/route.ts` | Validated chat entry point |
| `app/api/dashboard/layout/route.ts` | Current main-dashboard layout API |
| `app/api/dashboard/charts/route.ts` | Earlier slot-based chart API retained in source |
| `lib/management-api.ts` | Business queries, mappings and aggregations |
| `lib/mongodb.ts` | Shared MongoDB connection |
| `lib/ai/providers.ts` | Model ordering, requests and failure handling |
| `lib/ai/engine.ts` | Tool orchestration and response loop |
| `lib/ai/tools.ts` | Authorized operational/analysis capabilities |
| `lib/ai/prompt.ts` | Product-specific behavior instructions |
| `lib/ai/visualization-policy.ts` | Aggregate visualization suggestions |
| `lib/ai/chart-server.ts` | Evidence-backed chart creation/persistence |
| `lib/ai/chart-spec.ts` | Chart schema and supported types |
| `lib/ai/dashboard-layout.ts` | Insert/replace/remove ordering logic |
| `components/portal/ai-chat-widget.tsx` | Compact/fullscreen launcher |
| `components/portal/ai-chart.tsx` | Interactive chart renderer |
| `components/portal/dashboard-chart-board.tsx` | Integrated editable chart layout |
| `scripts/test-*.ts` | Focused integration and behavior checks |

Evidence sources for this report: `package.json`, current modules above, `SYSTEM_REVIEW.md`, `AI_UPGRADE.md`, `live-agent-evaluation.json`, `latency-evaluation.json`, `auto-visualization-evaluation.json`, `text-only-evaluation.json` aur recorded test outcomes in this development session. Older documents historical context hain; conflicting setup statements ko current source override karta hai.

## 20. Demo flow, success metrics aur presentation summary

### Suggested product demo

1. Admin login aur organization overview dikhayein.
2. Right-side Ask AI widget kholein; fullscreen/collapse demonstrate karein.
3. Poochein: "Unique students aur enrolments kitne hain?" Definitions ka difference explain karein.
4. Poochein: "Kin campuses mein enrolments zyada hain aur unmein kitna farq hai?" Chart explicitly na maangein.
5. Generated chart ke exact values aur visual type inspect karein.
6. Chart ko existing dashboard chart par drop karke replacement dikhayein.
7. Reorder, delete aur reload persistence demonstrate karein.
8. Unsupported question poochein, jaise graduate salaries, aur required-data explanation inspect karein.
9. Text-only preference de kar unnecessary chart avoidance demonstrate karein.

### Future success metrics

Product ki effectiveness objectively measure karne ke liye correct-answer rate, query failure rate, unnecessary-chart rate, useful-chart rate, median/P95 response time, role-isolation failures aur layout persistence failures track kiye ja sakte hain. Abhi sample timings aur targeted checks available hain; organization-wide KPI results available nahi.

### Presentation-ready project statement

"Mera project SMIT ke liye ek management aur AI analytics portal hai. Existing campuses, students, enrolments, trainers aur financial records ko role-based dashboards mein organize kiya gaya hai. Is phase mein main focus AI ko live MongoDB data par useful answers dene, limitations explain karne aur relevant questions ke liye khud interactive charts banane ke qabil banana tha. Dashboard widget, direct chart replacement, saved layouts aur faster provider routing add kiye gaye. AI ko fine-tune karne ke bajaye authorized query tools aur validation ke saath configure kiya gaya. Targeted tests mein real-data chart generation aur major latency improvement verify hui; production hardening aur broader quality evaluation next steps hain."
