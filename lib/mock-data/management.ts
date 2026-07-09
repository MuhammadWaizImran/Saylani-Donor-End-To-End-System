import type {
  ActiveClass,
  Campus,
  Course,
  Student,
  Trainer,
} from "@/types/management";

export const campuses: Campus[] = [
  { id: "cp1", name: "Gulshan Head Campus", city: "Karachi", address: "Main University Road, Gulshan-e-Iqbal", established: "2013", studentCount: 4200, trainerCount: 38, courseCount: 14, placementRate: 72, progressPercent: 84 },
  { id: "cp2", name: "Bahadurabad Campus", city: "Karachi", address: "A-25, Bahadurabad Chowrangi", established: "2016", studentCount: 2850, trainerCount: 24, courseCount: 10, placementRate: 68, progressPercent: 79 },
  { id: "cp3", name: "Hyderabad Campus", city: "Hyderabad", address: "Auto Bhan Road, Latifabad", established: "2019", studentCount: 1400, trainerCount: 12, courseCount: 7, placementRate: 61, progressPercent: 74 },
  { id: "cp4", name: "Johar Town Campus", city: "Lahore", address: "Block G-1, Johar Town", established: "2020", studentCount: 1950, trainerCount: 16, courseCount: 8, placementRate: 65, progressPercent: 77 },
  { id: "cp5", name: "Faisalabad Campus", city: "Faisalabad", address: "Susan Road, Madina Town", established: "2022", studentCount: 900, trainerCount: 8, courseCount: 5, placementRate: 54, progressPercent: 66 },
  { id: "cp6", name: "G-9 Campus", city: "Islamabad", address: "G-9 Markaz, Ibn-e-Sina Road", established: "2023", studentCount: 750, trainerCount: 7, courseCount: 5, placementRate: 49, progressPercent: 62 },
];

export const trainers: Trainer[] = [
  { id: "t1", name: "Kashif Mehmood", email: "kashif.mehmood@saylani.org", campusId: "cp1", salary: 185000, specialization: "MERN Stack Development", studentCount: 96, batchesCount: 11, placedCount: 148, performancePercent: 93, joinedAt: "2017-03-01" },
  { id: "t2", name: "Amina Siddiqui", email: "amina.siddiqui@saylani.org", campusId: "cp1", salary: 165000, specialization: "Python & AI", studentCount: 82, batchesCount: 8, placedCount: 104, performancePercent: 90, joinedAt: "2018-08-15" },
  { id: "t3", name: "Bilal Chauhan", email: "bilal.chauhan@saylani.org", campusId: "cp2", salary: 150000, specialization: "Flutter & Mobile Dev", studentCount: 74, batchesCount: 7, placedCount: 89, performancePercent: 87, joinedAt: "2019-01-10" },
  { id: "t4", name: "Sadia Rehman", email: "sadia.rehman@saylani.org", campusId: "cp2", salary: 140000, specialization: "UI/UX Design", studentCount: 61, batchesCount: 6, placedCount: 63, performancePercent: 84, joinedAt: "2020-06-01" },
  { id: "t5", name: "Omar Farooqi", email: "omar.farooqi@saylani.org", campusId: "cp3", salary: 135000, specialization: "Graphic Design", studentCount: 58, batchesCount: 6, placedCount: 51, performancePercent: 80, joinedAt: "2020-09-20" },
  { id: "t6", name: "Hina Aslam", email: "hina.aslam@saylani.org", campusId: "cp4", salary: 155000, specialization: "Data Analytics", studentCount: 68, batchesCount: 5, placedCount: 57, performancePercent: 86, joinedAt: "2021-02-14" },
  { id: "t7", name: "Danish Iqbal", email: "danish.iqbal@saylani.org", campusId: "cp5", salary: 125000, specialization: "Cyber Security", studentCount: 44, batchesCount: 3, placedCount: 26, performancePercent: 76, joinedAt: "2022-11-05" },
  { id: "t8", name: "Rabia Khanum", email: "rabia.khanum@saylani.org", campusId: "cp6", salary: 120000, specialization: "Digital Marketing", studentCount: 39, batchesCount: 3, placedCount: 19, performancePercent: 73, joinedAt: "2023-04-18" },
];

export const courses: Course[] = [
  { id: "co1", name: "Web & Mobile App Development", campusId: "cp1", trainerId: "t1", status: "running", enrolledCount: 96, progressPercent: 65, durationMonths: 12, startedAt: "2026-01-12" },
  { id: "co2", name: "Python for AI & Machine Learning", campusId: "cp1", trainerId: "t2", status: "running", enrolledCount: 82, progressPercent: 48, durationMonths: 10, startedAt: "2026-02-02" },
  { id: "co3", name: "Flutter App Development", campusId: "cp2", trainerId: "t3", status: "running", enrolledCount: 74, progressPercent: 71, durationMonths: 8, startedAt: "2025-12-01" },
  { id: "co4", name: "UI/UX Product Design", campusId: "cp2", trainerId: "t4", status: "running", enrolledCount: 61, progressPercent: 55, durationMonths: 6, startedAt: "2026-03-09" },
  { id: "co5", name: "Professional Graphic Design", campusId: "cp3", trainerId: "t5", status: "running", enrolledCount: 58, progressPercent: 82, durationMonths: 6, startedAt: "2026-01-05" },
  { id: "co6", name: "Data Analytics with Power BI", campusId: "cp4", trainerId: "t6", status: "running", enrolledCount: 68, progressPercent: 39, durationMonths: 8, startedAt: "2026-04-01" },
  { id: "co7", name: "Ethical Hacking & Cyber Security", campusId: "cp5", trainerId: "t7", status: "upcoming", enrolledCount: 44, progressPercent: 0, durationMonths: 9, startedAt: "2026-08-03" },
  { id: "co8", name: "Digital Marketing Bootcamp", campusId: "cp6", trainerId: "t8", status: "running", enrolledCount: 39, progressPercent: 24, durationMonths: 4, startedAt: "2026-05-18" },
  { id: "co9", name: "MERN Stack (Batch 10)", campusId: "cp1", trainerId: "t1", status: "completed", enrolledCount: 88, progressPercent: 100, durationMonths: 12, startedAt: "2025-01-06" },
  { id: "co10", name: "Video Editing & Motion Graphics", campusId: "cp3", trainerId: "t5", status: "completed", enrolledCount: 52, progressPercent: 100, durationMonths: 5, startedAt: "2025-08-11" },
];

export const students: Student[] = [
  { id: "s1", name: "Ahmed Raza", email: "ahmed.raza@student.pk", phone: "+92 300 1112201", campusId: "cp1", courseId: "co1", trainerId: "t1", enrollmentStatus: "active", progressPercent: 72, attendancePercent: 94, placementStatus: "studying" },
  { id: "s2", name: "Fatima Noor", email: "fatima.noor@student.pk", phone: "+92 321 4455662", campusId: "cp1", courseId: "co2", trainerId: "t2", enrollmentStatus: "active", progressPercent: 55, attendancePercent: 88, placementStatus: "studying" },
  { id: "s3", name: "Usman Tariq", email: "usman.tariq@student.pk", phone: "+92 333 7788003", campusId: "cp1", courseId: "co9", trainerId: "t1", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 96, placementStatus: "placed", company: "Systems Limited", salary: 145000, placementDate: "2026-03-15" },
  { id: "s4", name: "Zainab Ali", email: "zainab.ali@student.pk", phone: "+92 345 2233004", campusId: "cp1", courseId: "co9", trainerId: "t1", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 91, placementStatus: "placed", company: "Folio3", salary: 120000, placementDate: "2026-02-20" },
  { id: "s5", name: "Hamza Sheikh", email: "hamza.sheikh@student.pk", phone: "+92 301 8899005", campusId: "cp2", courseId: "co3", trainerId: "t3", enrollmentStatus: "active", progressPercent: 78, attendancePercent: 97, placementStatus: "studying" },
  { id: "s6", name: "Ayesha Malik", email: "ayesha.malik@student.pk", phone: "+92 322 5566006", campusId: "cp2", courseId: "co4", trainerId: "t4", enrollmentStatus: "active", progressPercent: 61, attendancePercent: 85, placementStatus: "studying" },
  { id: "s7", name: "Ibrahim Qureshi", email: "ibrahim.q@student.pk", phone: "+92 334 1122007", campusId: "cp2", courseId: "co3", trainerId: "t3", enrollmentStatus: "inactive", progressPercent: 34, attendancePercent: 52, placementStatus: "studying" },
  { id: "s8", name: "Mahnoor Baig", email: "mahnoor.baig@student.pk", phone: "+92 346 9900008", campusId: "cp3", courseId: "co5", trainerId: "t5", enrollmentStatus: "active", progressPercent: 89, attendancePercent: 93, placementStatus: "seeking" },
  { id: "s9", name: "Taha Jamil", email: "taha.jamil@student.pk", phone: "+92 302 3344009", campusId: "cp3", courseId: "co10", trainerId: "t5", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 89, placementStatus: "placed", company: "Digitz Media", salary: 85000, placementDate: "2026-01-28" },
  { id: "s10", name: "Khadija Aman", email: "khadija.aman@student.pk", phone: "+92 323 6677010", campusId: "cp4", courseId: "co6", trainerId: "t6", enrollmentStatus: "active", progressPercent: 42, attendancePercent: 90, placementStatus: "studying" },
  { id: "s11", name: "Danish Ali", email: "danish.ali@student.pk", phone: "+92 335 8899011", campusId: "cp4", courseId: "co6", trainerId: "t6", enrollmentStatus: "active", progressPercent: 47, attendancePercent: 95, placementStatus: "studying" },
  { id: "s12", name: "Hira Shahid", email: "hira.shahid@student.pk", phone: "+92 347 2233012", campusId: "cp4", courseId: "co6", trainerId: "t6", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 92, placementStatus: "placed", company: "Netsol Technologies", salary: 160000, placementDate: "2026-04-10" },
  { id: "s13", name: "Bilal Ahmed", email: "bilal.ahmed@student.pk", phone: "+92 303 5566013", campusId: "cp5", courseId: "co7", trainerId: "t7", enrollmentStatus: "active", progressPercent: 0, attendancePercent: 0, placementStatus: "studying" },
  { id: "s14", name: "Sana Mirza", email: "sana.mirza@student.pk", phone: "+92 324 7788014", campusId: "cp6", courseId: "co8", trainerId: "t8", enrollmentStatus: "active", progressPercent: 28, attendancePercent: 87, placementStatus: "studying" },
  { id: "s15", name: "Omar Siddiqui", email: "omar.siddiqui@student.pk", phone: "+92 336 9900015", campusId: "cp1", courseId: "co9", trainerId: "t1", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 94, placementStatus: "placed", company: "10Pearls", salary: 175000, placementDate: "2026-05-02" },
  { id: "s16", name: "Maryam Iqbal", email: "maryam.iqbal@student.pk", phone: "+92 348 1122016", campusId: "cp1", courseId: "co2", trainerId: "t2", enrollmentStatus: "active", progressPercent: 51, attendancePercent: 91, placementStatus: "studying" },
  { id: "s17", name: "Adeel Rahman", email: "adeel.rahman@student.pk", phone: "+92 304 3344017", campusId: "cp2", courseId: "co4", trainerId: "t4", enrollmentStatus: "inactive", progressPercent: 18, attendancePercent: 41, placementStatus: "studying" },
  { id: "s18", name: "Rabia Aslam", email: "rabia.aslam@student.pk", phone: "+92 325 5566018", campusId: "cp3", courseId: "co5", trainerId: "t5", enrollmentStatus: "active", progressPercent: 84, attendancePercent: 96, placementStatus: "seeking" },
  { id: "s19", name: "Yusuf Kamal", email: "yusuf.kamal@student.pk", phone: "+92 337 7788019", campusId: "cp1", courseId: "co1", trainerId: "t1", enrollmentStatus: "active", progressPercent: 69, attendancePercent: 89, placementStatus: "studying" },
  { id: "s20", name: "Amna Javed", email: "amna.javed@student.pk", phone: "+92 349 9900020", campusId: "cp2", courseId: "co3", trainerId: "t3", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 98, placementStatus: "placed", company: "Techlogix", salary: 130000, placementDate: "2026-06-01" },
  { id: "s21", name: "Saad Hussain", email: "saad.hussain@student.pk", phone: "+92 305 1122021", campusId: "cp4", courseId: "co6", trainerId: "t6", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 88, placementStatus: "placed", company: "Arbisoft", salary: 150000, placementDate: "2026-05-22" },
  { id: "s22", name: "Noor Fatima", email: "noor.fatima@student.pk", phone: "+92 326 3344022", campusId: "cp1", courseId: "co9", trainerId: "t1", enrollmentStatus: "active", progressPercent: 100, attendancePercent: 95, placementStatus: "placed", company: "Remote — US startup", salary: 320000, placementDate: "2026-04-28" },
  { id: "s23", name: "Hassan Raza", email: "hassan.raza@student.pk", phone: "+92 338 5566023", campusId: "cp5", courseId: "co7", trainerId: "t7", enrollmentStatus: "active", progressPercent: 0, attendancePercent: 0, placementStatus: "studying" },
  { id: "s24", name: "Iqra Baloch", email: "iqra.baloch@student.pk", phone: "+92 350 7788024", campusId: "cp6", courseId: "co8", trainerId: "t8", enrollmentStatus: "active", progressPercent: 31, attendancePercent: 84, placementStatus: "studying" },
];

export const activeClasses: ActiveClass[] = [
  { id: "ac1", name: "WMA Batch 12 — Section A", campusId: "cp1", trainerId: "t1", courseId: "co1", studentCount: 48, timing: "Mon–Fri · 9:00–11:00 AM" },
  { id: "ac2", name: "WMA Batch 12 — Section B", campusId: "cp1", trainerId: "t1", courseId: "co1", studentCount: 48, timing: "Mon–Fri · 2:00–4:00 PM" },
  { id: "ac3", name: "Python AI — Morning", campusId: "cp1", trainerId: "t2", courseId: "co2", studentCount: 41, timing: "Mon–Sat · 10:00–12:00 PM" },
  { id: "ac4", name: "Flutter Batch 7", campusId: "cp2", trainerId: "t3", courseId: "co3", studentCount: 37, timing: "Tue–Sat · 4:00–6:00 PM" },
  { id: "ac5", name: "UI/UX Studio Lab", campusId: "cp2", trainerId: "t4", courseId: "co4", studentCount: 31, timing: "Mon–Thu · 5:00–7:30 PM" },
  { id: "ac6", name: "Design Fundamentals", campusId: "cp3", trainerId: "t5", courseId: "co5", studentCount: 29, timing: "Mon–Fri · 11:00–1:00 PM" },
  { id: "ac7", name: "Analytics Evening Batch", campusId: "cp4", trainerId: "t6", courseId: "co6", studentCount: 34, timing: "Mon–Fri · 6:00–8:00 PM" },
  { id: "ac8", name: "Marketing Sprint 3", campusId: "cp6", trainerId: "t8", courseId: "co8", studentCount: 20, timing: "Sat–Sun · 10:00–2:00 PM" },
];
