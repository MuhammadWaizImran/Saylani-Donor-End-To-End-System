/**
 * The agent's map of the real database — all 53 collections, grouped by what
 * they're for.
 *
 * This lives here rather than in the system prompt on purpose. Inlining every
 * collection's fields would cost ~4,000 tokens on EVERY request, and Groq's
 * free tier only allows 8,000 tokens/minute — the agent would rate-limit
 * itself before answering anything. Served through the describe_schema tool
 * instead, it costs nothing until the agent actually needs a collection, and
 * then only that one collection's detail comes back.
 *
 * Field notes are written for a reader who has never seen this database:
 * they record what a field MEANS and where it lies, not just its type.
 * Everything here was verified against the live database, not assumed.
 */

/**
 * Nearly every collection carries these, so documenting them 53 times would
 * just be noise the agent pays for on every lookup. describe_schema folds
 * them in instead.
 */
export const UNIVERSAL_FIELDS: Record<string, string> = {
  _id: "Primary key. Usually an ObjectId; `campaigns`, `donations` and `public_donors` use plain STRINGS instead.",
  createdAt: "When the row was created — this is the date to group by for any 'per month' question unless a more specific date field exists.",
  updatedAt: "When the row was last modified.",
};

/**
 * The indexes that actually exist, read off the live database. The agent uses
 * these to pick a filter that the database can answer quickly: filtering on an
 * indexed field is a lookup, filtering on anything else is a full scan of the
 * collection. Anything not listed here is unindexed.
 */
export const INDEXES: Record<string, string[]> = {
  agent_conversations: ["userId + updatedAt"],
  attendances: ["student_id"],
  campus: ["city"],
  donations: ["createdAt"],
  new_courses: ["status", "campus", "course"],
  payments: ["student", "status"],
  portal_donors: ["email"],
  revoked_sessions: ["jti", "expiresAt"],
  slots: ["trainer", "campus", "new_course"],
  student_inductions: [
    "campus",
    "trainer",
    "new_course",
    "course",
    "status",
    "student_id",
    "campus + status (compound — best for 'status breakdown of one campus')",
  ],
  trainer_attendances: ["trainer", "status"],
  trainers: ["campus", "email"],
  users: ["email"],
};

/**
 * Which collections point at which. Written as a directed list so the agent
 * can plan a join in either direction without guessing a field name.
 */
export const RELATIONS: Record<string, string[]> = {
  attendances: ["student_induction → student_inductions", "student_id → students", "slot → slots"],
  campus: ["city → cities"],
  certificates: ["student_induction → student_inductions"],
  cities: ["country → countries"],
  classes: ["slot → slots"],
  course_modules: ["course → courses"],
  course_progresses: ["course → courses", "course_module → course_modules", "course_topic → course_topics", "slot → slots"],
  course_syllabuses: ["module → course_modules", "course → courses"],
  course_topics: ["course → courses", "course_module → course_modules"],
  assignments: ["slot → slots", "trainer → trainers", "new_course → new_courses"],
  assignment_submissions: [
    "assignment → assignments",
    "student_induction → student_inductions",
    "NO campus field — reach campus via student_induction → student_inductions.campus",
  ],
  donations: ["campaignId → campaigns.id (a STRING id, not an ObjectId)"],
  donors: ["campuses[] → campus"],
  events: ["course → courses", "campus → campus"],
  feedbacks: ["student_induction → student_inductions", "trainer → trainers"],
  logs: ["action_by → users", "doc_id → the record named by the `model` field"],
  new_courses: ["course → courses", "campuses[] → campus (ARRAY)", "city → cities"],
  online_classes: ["slot → slots"],
  payments: ["student → students", "student_induction → student_inductions"],
  points: ["student_induction → student_inductions", "slot → slots"],
  student_points: ["student_induction → student_inductions", "slot → slots"],
  questions: ["quiz → quizzes"],
  quiz_schedules: ["quiz → quizzes", "slot → slots", "question_ids[] → questions"],
  quizzes: ["courses[] → courses (ARRAY)", "course_module → course_modules"],
  ratings: ["student_induction → student_inductions", "slot → slots"],
  results: ["quiz → quizzes", "student_induction → student_inductions", "slot → slots"],
  roles: ["permissions[] → permissions"],
  scholarships: ["student → students", "student_induction → student_inductions"],
  slots: ["new_course → new_courses", "campus → campus", "trainer → trainers"],
  success_stories: ["slot → slots"],
  trainer_attendances: ["trainer → trainers", "slot → slots"],
  trainer_attendance_requests: ["attendance → trainer_attendances", "created_by / action_by → users"],
  trainers: ["campus[] → campus (ARRAY)", "courses[] → courses (ARRAY)", "city[] → cities (ARRAY)", "country → countries"],
  users: ["campus[] → campus (ARRAY)", "city[] → cities (ARRAY)", "country → countries"],
  ambassadors: ["campus → campus", "new_course → new_courses"],
};

export interface CollectionInfo {
  /** What this collection is for, in one line. */
  purpose: string;
  /** Roughly how many documents — orients the agent on whether it's a lookup
   *  table or a fact table. Not kept exact; it changes as data is added. */
  approxDocs: number;
  /** field name → what it actually means. */
  fields: Record<string, string>;
  /** How it joins to other collections. */
  relations?: string[];
  /** Traps that would otherwise produce a wrong answer. */
  gotchas?: string[];
}

export type Domain =
  | "core"
  | "lms"
  | "attendance"
  | "fees"
  | "charity"
  | "engagement"
  | "careers"
  | "system";

export const DOMAIN_LABELS: Record<Domain, string> = {
  core: "Core pipeline — campuses, courses, students, trainers, classes",
  lms: "Learning — quizzes, assignments, results, certificates, syllabus",
  attendance: "Attendance — student check-ins and trainer check-in/out",
  fees: "Student fees — invoices and scholarships",
  charity: "Fundraising — donations, campaigns, donors",
  engagement: "Engagement — points, ratings, feedback, events, content",
  careers: "Careers — job postings",
  system: "System — auth, roles, audit logs, internal jobs",
};

/** Fields that are NEVER returned from any collection, whatever is asked.
 *  Password hashes and session ids answer no question anyone would ask; the
 *  only thing they can do is leak. Matched case-insensitively against the
 *  whole field name. */
export const REDACTED_FIELDS = ["password", "jti", "token", "secret", "trainer_signature", "student_signature"];

export const SCHEMA: Record<Domain, Record<string, CollectionInfo>> = {
  /* ── core pipeline ──────────────────────────────────────── */
  core: {
    students: {
      purpose: "One row per PERSON — their personal details only. Carries no campus, course or status.",
      approxDocs: 106,
      fields: {
        full_name: "Student's name (plain string, not nested)",
        father_name: "Father's name",
        email: "Login email",
        gender: "male / female",
        date_of_birth: "Date — age is derivable from this",
        contact_number: "Phone",
        student_cnic: "National ID number",
        father_cnic: "Father's national ID",
        full_address: "Home address",
        last_qualification: "Prior education level",
        image: "Profile photo URL",
      },
      relations: ["student_inductions.student_id → students._id"],
      gotchas: [
        "A student's campus/course/status is NOT here — it lives on student_inductions.",
        "This collection has a password field; it is always redacted.",
      ],
    },
    student_inductions: {
      purpose:
        "THE HUB. One row per ENROLMENT, not per person — a student who enrols twice has two rows. Holds status, dates, and the foreign keys to everything else.",
      approxDocs: 118,
      fields: {
        status: "enrolled | pending | passed | completed | dropout | rejected | blacklisted. No other values exist.",
        student_id: "→ students._id (the person)",
        campus: "→ campus._id",
        city: "→ cities._id",
        country: "→ countries._id",
        course: "→ courses._id (the subject)",
        new_course: "→ new_courses._id (the specific batch/offering)",
        slot: "→ slots._id (the class section)",
        trainer: "→ trainers._id",
        section: "Section letter/name within the slot",
        batch_number: "Which batch of the course",
        roll_number: "Roll number — lives on the ENROLMENT, not the person",
        laptop: "Whether the student has a laptop",
        metadata: "Nested: category, sub_category, t_shirt_size, alumni, alumni_course",
        slot_transition: "Array of {date, slot} — the history of slot changes",
        is_sponsored: "Whether a donor sponsors this enrolment",
        sponsored_by: "→ the sponsoring donor",
        sponsor_message: "Message from the sponsor",
        createdAt: "When the enrolment was created — use this for 'enrolments by month'",
        updated_by: "→ users._id who last changed it",
      },
      relations: [
        "students, campus, cities, courses, new_courses, slots, trainers",
        "Most child records point back here via a student_induction field: attendances, results, certificates, payments, scholarships, points, ratings, feedbacks, assignment_submissions",
      ],
      gotchas: [
        "Almost every 'how many students by X' question is a grouping of THIS collection — not a count of students.",
        "There is no dropout_date/dropout_reason field on the live records; dropouts are identified by status='dropout' and dated by createdAt/updatedAt.",
      ],
    },
    campus: {
      purpose: "The 8 physical campuses.",
      approxDocs: 8,
      fields: {
        "en.campus_name": "English name — ALWAYS report this, never the _id",
        "en.address": "English address",
        "ur.campus_name": "Urdu name",
        city: "→ cities._id",
        phone_number: "Contact number",
        latitude: "Map latitude",
        longitude: "Map longitude",
        slug: "URL slug",
        is_sponsored: "Whether the campus has a sponsor",
      },
      gotchas: ["The collection is named `campus` (singular), not `campuses`."],
    },
    cities: {
      purpose: "Cities that campuses sit in.",
      approxDocs: 8,
      fields: { "en.city_name": "English city name", country: "→ countries._id", is_sponsored: "Sponsored flag" },
    },
    countries: {
      purpose: "Countries — only 3, effectively a lookup table.",
      approxDocs: 3,
      fields: { "en.country_name": "English country name" },
    },
    courses: {
      purpose: "The course CATALOG — the subject itself ('Web & App Development'), not a specific class.",
      approxDocs: 11,
      fields: {
        "en.course_name": "English course name — report this, never the _id",
        "en.course_category": "Category",
        "en.course_duration": "How long the course runs",
        "en.outline": "Course outline",
        "en.description": "Description",
        show_on_website: "Public visibility flag",
        course_slug: "URL slug",
        sequence: "Display order",
        cover_image: "Cover image URL",
      },
      gotchas: [
        "Some course names carry stray tab characters — trim before displaying.",
        "A course exists TWICE: `courses` is the subject, `new_courses` is a specific offering of it.",
      ],
    },
    new_courses: {
      purpose: "A specific OFFERING/batch of a course at one or more campuses.",
      approxDocs: 30,
      fields: {
        course: "→ courses._id (which subject)",
        campuses: "ARRAY of → campus._id (note: plural, and it's an array)",
        city: "→ cities._id",
        batch_number: "Batch number",
        status: "BOOLEAN true/false here, not a string — true means currently running",
        gender: "Nested {en, ur} — which gender this offering is for",
        type: 'Only "COURSE" is present (uppercase).',
        category: "Nested {en, ur}",
        is_online: "Whether it runs online",
        fees: "Course fee for this offering",
        sub_category: "Nested {en, ur}",
        instruction: "Array of instruction notes",
      },
      gotchas: ["`campuses` is an ARRAY, and `status` is a BOOLEAN here (not a string)."],
    },
    course_categories: {
      purpose: "Course category lookup.",
      approxDocs: 3,
      fields: { "en.category_name": "English category name" },
    },
    slots: {
      purpose: "The actual class SECTIONS — a timetabled group with a trainer, capacity and schedule.",
      approxDocs: 20,
      fields: {
        new_course: "→ new_courses._id",
        campus: "→ campus._id",
        trainer: "→ trainers._id",
        capacity: "Total seats",
        booked: "Seats taken",
        schedule: "Human-readable schedule string",
        timing: "Array of {day, start, end}",
        status: "active | started | completed | inactive",
        gender: "Which gender the slot is for",
        class_type: "AUDITORIUM | LAB (uppercase)",
        is_online: "Online or on-site",
        start_date: "Start date",
        end_date: "End date",
        trainer_hourly_rate: "Trainer's rate for this slot (PKR/hour)",
      },
    },
    classes: {
      purpose: "Individual class SESSIONS — one row per slot per date.",
      approxDocs: 334,
      fields: { slot: "→ slots._id", date: "The date this session ran" },
    },
    sections: {
      purpose: "Nearly empty (1 doc with no real fields) — carries no usable data.",
      approxDocs: 1,
      fields: {},
      gotchas: ["Effectively unused. Don't build answers on it."],
    },
    trainers: {
      purpose: "The teaching staff.",
      approxDocs: 12,
      fields: {
        "en.trainer_name": "English name — report this, never the _id",
        email: "Login email",
        hourly_rate: "Pay rate in PKR per HOUR (never per month)",
        campus: "ARRAY of → campus._id",
        courses: "ARRAY of → courses._id",
        course: "→ courses._id (older single-course field — check both)",
        city: "ARRAY of → cities._id",
        phone_number: "Contact",
        employee_id: "Staff number",
        is_deleted: "SOFT DELETE flag. Rows with is_deleted true are removed staff — exclude them from any head-count or you will over-report trainers.",
        country: "→ countries._id",
        description: "Bio",
        social_links: "Array of {name, url}",
      },
      gotchas: [
        "`campus`, `courses` and `city` are ARRAYS, not single ids.",
        "Trainers authenticate from THIS collection, not from `users`. Password is always redacted.",
      ],
    },
  },

  /* ── learning ───────────────────────────────────────────── */
  lms: {
    quizzes: {
      purpose: "Quiz definitions — the template, not a student's attempt.",
      approxDocs: 25,
      fields: {
        title: "Quiz title",
        description: "Description",
        duration: "Time limit in minutes",
        total_questions: "How many questions",
        passing_percentage: "Pass mark",
        attempts_allowed: "How many tries a student gets",
        is_active: "Whether it's live",
        courses: "ARRAY of → courses._id",
        course: "ARRAY of → courses._id — an older duplicate of `courses`. Both exist on real rows, so check both before concluding a quiz has no course.",
        course_module: "→ course_modules._id",
        tags: "Array of tags",
      },
    },
    questions: {
      purpose: "The question bank — individual quiz questions with their options and answers.",
      approxDocs: 353,
      fields: {
        text: "The question text",
        type: "single | multiple",
        options: "Array of {optionText, id}",
        answer: "Array of correct option ids",
        difficulty: "easy | medium | hard",
        quiz: "→ quizzes._id",
        tags: "Array of tags",
      },
    },
    quiz_schedules: {
      purpose: "When a quiz is scheduled for a specific slot.",
      approxDocs: 98,
      fields: {
        quiz: "→ quizzes._id",
        slot: "→ slots._id",
        date: "When it runs",
        expiry: "When it closes",
        status: 'Only "active" is present.',
        question_ids: "ARRAY of → questions._id actually used",
      },
    },
    results: {
      purpose: "A student's quiz ATTEMPT and score. This is the real 'marks' data.",
      approxDocs: 23,
      fields: {
        score: "Score achieved",
        total_questions: "Out of how many",
        attempts: "Which attempt this was",
        time_used: "Seconds taken",
        status: "passed | failed | pending",
        quiz: "→ quizzes._id",
        student_induction: "→ student_inductions._id (the enrolment, not the person)",
        slot: "→ slots._id",
        answers: "Array of {question, isCorrect}",
      },
    },
    assignments: {
      purpose: "Assignments set by a trainer for a slot.",
      approxDocs: 52,
      fields: {
        title: "Assignment title",
        description: "Brief",
        submission_date: "Due date",
        status: "active | inactive",
        slot: "→ slots._id",
        trainer: "→ trainers._id",
        new_course: "→ new_courses._id",
        links: "Array of reference links",
        images: "Array of image URLs",
      },
    },
    assignment_submissions: {
      purpose: "What a student handed in for an assignment, and how it was reviewed.",
      approxDocs: 77,
      fields: {
        status: 'approved | submitted | late_submitted | not_approved. Note it is "not_approved", NOT "rejected".',
        marks: "Marks awarded",
        assignment: "→ assignments._id",
        student_induction: "→ student_inductions._id",
        submitted_date: "When it was handed in",
        trainer_feedback: "Trainer's written feedback",
        files: "Array of uploaded file URLs",
        link: "Submitted link",
        text: "Submitted text",
      },
      gotchas: [
        "There is NO campus field here — to scope by campus you must join through student_induction → student_inductions.campus.",
      ],
    },
    certificates: {
      purpose: "Certificates issued to students.",
      approxDocs: 4,
      fields: {
        student_name: "Name printed on the certificate",
        father_name: "Father's name printed",
        type: "course | hackathon",
        status: "in_progress | issued",
        student_induction: "→ student_inductions._id",
        hackathon: "→ a hackathon record, when the certificate is for one",
      },
    },
    course_modules: {
      purpose: "A course broken into modules.",
      approxDocs: 10,
      fields: {
        module_name: "Module name",
        module_description: "What it covers",
        module_number: "Ordering number",
        sequence: "Sort order",
        course: "→ courses._id",
        video_link: "Module video",
      },
    },
    course_topics: {
      purpose: "Topics inside a module.",
      approxDocs: 15,
      fields: {
        title: "Topic title",
        description: "What it covers",
        sequence: "Sort order",
        course: "→ courses._id",
        course_module: "→ course_modules._id",
      },
    },
    course_syllabuses: {
      purpose: "Syllabus entries for a course module.",
      approxDocs: 10,
      fields: { title: "Syllabus item", description: "Detail", module: "→ course_modules._id", course: "→ courses._id" },
    },
    course_progresses: {
      purpose: "Which topic a SLOT has reached — class-level teaching progress.",
      approxDocs: 34,
      fields: {
        course: "→ courses._id",
        course_module: "→ course_modules._id",
        course_topic: "→ course_topics._id",
        slot: "→ slots._id",
      },
      gotchas: [
        "This tracks the CLASS's progress through the syllabus, not an individual student's percentage. There is no per-student progress %.",
      ],
    },
    online_classes: {
      purpose: "Online (Zoom-style) class sessions.",
      approxDocs: 45,
      fields: {
        slot: "→ slots._id",
        meeting_id: "Meeting id",
        join_url: "Join link",
        date: "Session date",
        start_time: "Start",
        end_time: "End",
        status: "started | ended",
        host_id: "Meeting host id",
        start_url: "Host start link",
      },
      gotchas: ["Signature fields are redacted — they are credentials, not data."],
    },
  },

  /* ── attendance ─────────────────────────────────────────── */
  attendance: {
    attendances: {
      purpose: "STUDENT class check-ins — one row per student per session marked.",
      approxDocs: 414,
      fields: {
        status: 'Only "present" is ever recorded — absences are simply missing rows, so an absence count cannot be read off this field.',
        attendance_for: 'Only "class" is present.',
        student_induction: "→ student_inductions._id",
        student_id: "→ students._id",
        slot: "→ slots._id",
        time_stamp: "When the check-in happened",
      },
      gotchas: [
        "Only covers a subset of students — do NOT present a per-student attendance % as if it covered everyone.",
      ],
    },
    trainer_attendances: {
      purpose: "TRAINER check-in/check-out with worked minutes and lateness.",
      approxDocs: 44,
      fields: {
        trainer: "→ trainers._id",
        slot: "→ slots._id",
        check_in: "Check-in time",
        check_out: "Check-out time",
        minutes: "Minutes worked",
        late_check_in_minutes: "How late they arrived",
        early_check_out_minutes: "How early they left",
        status: "present | approved | pending | rejected | deleted",
      },
    },
    trainer_attendance_requests: {
      purpose: "Trainer requests to correct an attendance record, and their approval.",
      approxDocs: 27,
      fields: {
        attendance: "→ trainer_attendances._id",
        reason: "Why the correction is requested",
        type: "Request type",
        check_in: "Requested check-in",
        check_out: "Requested check-out",
        created_by: "→ who raised it",
        action_by: "→ who approved/rejected",
        action_time: "When it was actioned",
      },
    },
  },

  /* ── student fees ───────────────────────────────────────── */
  fees: {
    payments: {
      purpose: "STUDENT FEE INVOICES (Blinq / 1Bill). This is tuition billing — NEVER charity donations.",
      approxDocs: 106,
      fields: {
        student: "→ students._id",
        student_induction: "→ student_inductions._id",
        amount: "Invoice amount — stored as a STRING, convert before summing",
        format_amount: "Pre-formatted display amount",
        billing_month: "YYMM string, e.g. '2607' = July 2026",
        due_date: "Due date",
        due_date_student: "Due date as shown to the student",
        status: 'DIRTY DATA: real values are "paid", "pending", "paida" and "pa\naid" (a typo and a stray newline). Treat any value starting with "pa" as paid — never match "paid" exactly or you will undercount.',
        type: "monthly | registration | certificate",
        transaction_amount: "Amount actually transacted",
        transaction_id: "Transaction reference",
        tran_date: "Transaction date",
        blinq_invoice_number: "Blinq invoice number",
        one_bill_id: "1Bill id",
        click_to_pay_url: "Payment link",
        meta_data: "Nested gateway response: paid_on, invoice_status, payment_id …",
      },
      gotchas: [
        "billing_month is YYMM, NOT YYYY-MM. '2607' means July 2026.",
        "`amount` is a string — always convert before arithmetic.",
      ],
    },
    scholarships: {
      purpose: "Scholarship awards to students.",
      approxDocs: 26,
      fields: {
        status: 'Only value present is "approved". Every scholarship row is an approved award.',
        student: "→ students._id",
        student_induction: "→ student_inductions._id",
      },
    },
  },

  /* ── fundraising ────────────────────────────────────────── */
  charity: {
    donations: {
      purpose: "CHARITY donations to campaigns. Completely separate from student fees.",
      approxDocs: 24,
      fields: {
        campaignId: "→ campaigns.id",
        donorName: "Donor's name as given",
        amount: "Donation amount (number)",
        currency: "Currency code",
        isAnonymous: "Whether to hide the donor's name",
        message: "Donor's message",
        createdAt: "ISO date STRING, not a Date object",
        id: "String id (this collection uses string keys, not ObjectId)",
      },
      gotchas: [
        "_id and createdAt are STRINGS here, not ObjectId/Date — this collection came from a different system.",
        "Contains no bank-account or card fields. Say so plainly rather than inventing them.",
      ],
    },
    campaigns: {
      purpose: "Fundraising campaigns donations are raised against.",
      approxDocs: 10,
      fields: {
        title: "Campaign title",
        tagline: "Short tagline",
        description: "Description",
        story: "Array of story paragraphs",
        goalAmount: "Target amount",
        raisedAmount: "Raised so far",
        donorCount: "Number of donors",
        id: "String id — this is what donations.campaignId points at, NOT _id",
        category: "Education | Healthcare | Food Relief | Clean Water | Emergency | Orphan Care",
        location: "Where it applies",
        status: "active | urgent | completed",
        endsAt: "End date",
        slug: "URL slug",
        currency: "Currency code",
      },
      gotchas: ["_id is a STRING here, not an ObjectId."],
    },
    public_donors: {
      purpose: "Public-facing donor profiles with lifetime totals.",
      approxDocs: 3,
      fields: {
        name: "Donor name",
        email: "Email",
        phone: "Phone",
        totalDonated: "Lifetime total",
        donationCount: "How many donations",
        memberSince: "Join date",
        id: "String id (this collection uses string keys, not ObjectId)",
      },
    },
    donors: {
      purpose: "Sponsor accounts tied to specific campuses (the training system's own donor records).",
      approxDocs: 1,
      fields: {
        name: "Donor name",
        email: "Email",
        cnic: "National ID",
        contact_no: "Phone",
        campuses: "ARRAY of → campus._id they sponsor",
      },
      gotchas: ["Barely used (1 record). Password redacted."],
    },
    portal_donors: {
      purpose: "Donor logins for THIS portal (our own accounts, not the training system's).",
      approxDocs: 3,
      fields: { name: "Donor name", email: "Login email", createdAt: "When registered" },
      gotchas: ["Password redacted."],
    },
  },

  /* ── engagement ─────────────────────────────────────────── */
  engagement: {
    points: {
      purpose: "Points awarded to a student enrolment.",
      approxDocs: 7,
      fields: {
        point: "Points awarded",
        type: 'Only "assignment_submission" is present.',
        student_induction: "→ student_inductions._id",
        slot: "→ slots._id",
        document: "→ the record the points relate to",
      },
    },
    student_points: {
      purpose: "Same shape as `points` — a near-duplicate collection with 1 record.",
      approxDocs: 1,
      fields: { point: "Points", type: "Type", student_induction: "→ student_inductions._id", slot: "→ slots._id", document: "→ the record the points relate to" },
      gotchas: ["Almost empty. `points` is the one actually in use."],
    },
    ratings: {
      purpose: "Student feedback scores for a class, its trainer and the staff.",
      approxDocs: 2,
      fields: {
        rating: "Overall rating",
        trainer_rating: "Trainer score",
        class_rating: "Class score",
        staff_rating: "Staff score",
        comment: "Written comment",
        student_induction: "→ student_inductions._id",
        slot: "→ slots._id",
      },
    },
    feedbacks: {
      purpose: "Bug reports / feedback submitted from the app, with device details.",
      approxDocs: 2,
      fields: {
        type: "bug | other",
        note: "What they wrote",
        status: 'Only "open" is present.',
        student_induction: "→ student_inductions._id",
        trainer: "→ trainers._id",
        browser: "Browser",
        os: "Operating system",
        is_mobile: "Mobile or not",
        images: "Attached screenshots",
        ua: "Raw user-agent string",
        platform: "Client platform",
      },
    },
    success_stories: {
      purpose: "Published graduate success stories used on the website.",
      approxDocs: 2,
      fields: {
        name: "Graduate's name",
        designation: "Their job title",
        story: "Full story text",
        description: "Short description",
        video: "Video URL",
        slot: "→ slots._id they studied in",
        is_active: "Published or not",
        order: "Display order",
      },
      gotchas: [
        "These are marketing stories, NOT placement records. Do not use them to claim a job-placement rate.",
      ],
    },
    ambassadors: {
      purpose: "Student ambassadors representing a campus.",
      approxDocs: 2,
      fields: {
        full_name: "Name",
        email: "Email",
        phone_number: "Phone",
        roll_no: "Roll number",
        campus: "→ campus._id",
        new_course: "→ new_courses._id",
        qualification: "Education",
        cnic: "National ID number",
        gender: "Gender",
        bio: "Bio",
        status: "active | pending",
      },
    },
    events: {
      purpose: "Campus events with seat limits and enrolment counts.",
      approxDocs: 2,
      fields: {
        title: "Event title",
        description: "Description",
        course: "→ courses._id",
        campus: "→ campus._id",
        start_time: "Start",
        end_time: "End",
        seat_limit: "Capacity",
        enrolled_count: "How many signed up",
        status: "open | draft",
        tags: "Array of tags",
      },
    },
    news: {
      purpose: "News/blog articles for the public website.",
      approxDocs: 1,
      fields: {
        title: "Headline",
        description: "Body",
        meta_description: "SEO description",
        category: "Category",
        author: "Author",
        published_at: "Publish date",
        location: "Location",
        status: 'Only "active" is present.',
        tags: "Array of tags",
      },
    },
    announcements: {
      purpose: "In-app announcements shown to users, bilingual.",
      approxDocs: 4,
      fields: {
        "en.heading": "English heading",
        "en.note": "English body",
        "ur.heading": "Urdu heading",
        background: "Background style",
        status: 'Uppercase "ACTIVE".',
      },
    },
  },

  /* ── careers ────────────────────────────────────────────── */
  careers: {
    jobs: {
      purpose: "Job POSTINGS advertised to students. NOT a record of who got hired.",
      approxDocs: 4,
      fields: {
        title: "Job title",
        company: "Hiring company",
        description: "Job description",
        location: "Location",
        salary: "Nested {min, max}",
        jobType: "Part-time | Internship",
        siteType: "On-site | Remote",
        skillsRequired: "Array of skills",
        deadline: "Application deadline",
        isActive: "Still open",
        postedAt: "When posted",
        postedBy: "Who posted it",
      },
      gotchas: [
        "CRITICAL: these are vacancies, not placements. No collection anywhere records which student got which job, at what salary. Never answer a placement-rate question from this.",
      ],
    },
  },

  /* ── system ─────────────────────────────────────────────── */
  system: {
    users: {
      purpose: "Staff/admin accounts for the training system.",
      approxDocs: 13,
      fields: {
        email: "Login email",
        role: "SUPER_ADMIN | super_admin | ADMIN | CAMPUS_MANAGER | RECEPTIONIST. MIXED CASE — compare case-insensitively.",
        status: "active | inactive",
        campus: "ARRAY of → campus._id they administer",
        city: "ARRAY of → cities._id",
        isSuperAdmin: "Super-admin flag",
        country: "→ countries._id",
        is_dev: "Developer account flag",
        permissions: "Nested permission object",
      },
      gotchas: ["Password is always redacted. Admin logins require role admin/super_admin AND status active."],
    },
    roles: {
      purpose: "Named roles and the permissions attached to each.",
      approxDocs: 3,
      fields: { title: "Role name", description: "What it's for", permissions: "ARRAY of → permissions._id" },
    },
    permissions: {
      purpose: "Individual permission entries, grouped by module.",
      approxDocs: 25,
      fields: { name: "Permission name", module: "Which module it governs" },
    },
    logs: {
      purpose: "Audit trail — who changed what record, when, and via which route.",
      approxDocs: 26,
      fields: {
        action_by: "→ users._id who did it",
        action: 'Only "UPDATE" is present so far.',
        model: "student | student_induction",
        doc_id: "→ the record affected",
        changed_fields: "Array of field names changed",
        changes: "The new values",
        route: "API route used",
        method: 'Only "PUT" is present.',
        role: "super_admin | student",
      },
    },
    revoked_sessions: {
      purpose: "Logged-out session ids, kept until they would have expired anyway.",
      approxDocs: 4,
      fields: { expiresAt: "When the entry can be dropped" },
      gotchas: ["The session id itself (jti) is redacted."],
    },
    agent_conversations: {
      purpose: "This assistant's OWN saved chat history.",
      approxDocs: 52,
      fields: {
        userId: "Who the conversation belongs to",
        role: "Their role",
        title: "Conversation title",
        messages: "Array of {role, content, createdAt}",
      },
      gotchas: ["Reading other people's conversations is a privacy leak — only ever discuss the current user's own."],
    },
    counters: {
      purpose: "Internal auto-increment counters (roll numbers etc.).",
      approxDocs: 2,
      fields: {
        name: "Counter name",
        seq: "Current value",
        id: "Counter key",
        reference_value: "Optional value this counter is scoped to",
      },
    },
    agendaJobs: {
      purpose: "Background job queue used by the training system.",
      approxDocs: 25,
      fields: { name: "Job name", data: "Job payload", lastRunAt: "Last run", nextRunAt: "Next scheduled run" },
      gotchas: ["Internal plumbing — no business meaning."],
    },
    "reports.files": {
      purpose: "GridFS file metadata for generated reports. Currently empty.",
      approxDocs: 0,
      fields: {},
    },
  },
};

/** Every collection name the agent may read, flattened. */
export const ALL_COLLECTIONS: string[] = Object.values(SCHEMA).flatMap((group) => Object.keys(group));

/** Look one up regardless of which domain it sits in. */
export function findCollection(name: string): { domain: Domain; info: CollectionInfo } | null {
  for (const [domain, group] of Object.entries(SCHEMA) as Array<[Domain, Record<string, CollectionInfo>]>) {
    if (group[name]) return { domain, info: group[name] };
  }
  return null;
}

/** Strip secret fields from anything on its way back to the model. */
export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const src = value as Record<string, unknown>;
    // ObjectId and friends must survive untouched — only walk plain objects.
    if (src._bsontype || src.constructor?.name === "ObjectId") return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (REDACTED_FIELDS.some((f) => k.toLowerCase().includes(f))) continue;
      if (k === "__v") continue;
      out[k] = redact(v);
    }
    return out as unknown as T;
  }
  return value;
}
