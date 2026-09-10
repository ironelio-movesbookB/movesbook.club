"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Bug,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Code2,
  Cog,
  CreditCard,
  FileText,
  Heart,
  HelpCircle,
  Home,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Newspaper,
  Phone,
  Puzzle,
  RefreshCcw,
  Settings,
  Shield,
  ShoppingCart,
  Tags,
  User,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
}

interface ProfileDropdownMenuProps {
  onClose?: () => void;
  onLogout?: () => void;
}

const menuSections: MenuSection[] = [
  {
    id: "profile",
    title: "Your profile & account",
    items: [
      {
        label: "Profile",
        href: "/profile",
        icon: User,
      },
      {
        label: "Quick config",
        href: "/users/club_user_faccess",
        icon: Settings,
      },
      {
        label: "Account info and settings",
        href: "/users/account",
        icon: Cog,
      },
      {
        label: "Privacy settings",
        href: "/users/permission_settings",
        icon: Shield,
      },
      {
        label: "Passwords",
        href: "/users/password_managing",
        icon: KeyRound,
      },
    ],
  },
  {
    id: "purchase",
    title: "Purchase",
    items: [
      {
        label: "Purchase new accounts",
        href: "/clubs/club_purchase_account",
        icon: UserPlus,
      },
      {
        label: "Purchase new ID cards",
        href: "/clubs/club_price_list",
        icon: CreditCard,
      },
      {
        label: "Enable ID cards of other firms",
        href: "/clubs/club_price_list",
        icon: CreditCard,
      },
      {
        label: "Buy a management module",
        href: "#",
        icon: Puzzle,
      },
      {
        label: "Buy space for sponsors",
        href: "/ClubSponsors",
        icon: CreditCard,
      },
      {
        label: "Buy a product in the shop",
        href: "#",
        icon: ShoppingCart,
      },
    ],
  },
  {
    id: "requests",
    title: "Requests and messages",
    items: [
      {
        label: "Requests of friendship",
        href: "#",
        icon: Heart,
      },
      {
        label: "Accepted friendship",
        href: "#",
        icon: Heart,
      },
      {
        label: "Outgoing sharing requests",
        href: "#",
        icon: RefreshCcw,
      },
      {
        label: "Incoming sharing requests",
        href: "#",
        icon: RefreshCcw,
      },
      {
        label: "Send an invite to become a member",
        href: "#",
        icon: Mail,
      },
      {
        label: "Membership notifications",
        href: "#",
        icon: Bell,
      },
    ],
  },
  {
    id: "alerts",
    title: "Alerts and posts",
    items: [
      {
        label: "Alerts and notices at login",
        href: "#",
        icon: Bell,
      },
      {
        label: "Message at logout",
        href: "#",
        icon: LogOut,
      },
      {
        label: "Intro messages for members",
        href: "#",
        icon: MessageCircle,
      },
      {
        label: "Posts on the club homepage",
        href: "#",
        icon: Home,
      },
    ],
  },
  {
    id: "messages",
    title: "Messages",
    items: [
      {
        label: "Notifications from movesbook staff",
        href: "/users/notification/all/all/movesbook",
        icon: Bell,
      },
      {
        label: "Notifications from club staff",
        href: "/users/notification/all/all/clubs",
        icon: MessageCircle,
      },
      {
        label: "Posted by Club staff (send)",
        href: "/users/clubnotification",
        icon: Mail,
      },
      {
        label: "My messages with staff",
        href: "/clubs/messages",
        icon: Mail,
      },
    ],
  },
  {
    id: "feedback",
    title: "Feedback and support",
    items: [
      {
        label: "Feedback for the club",
        href: "/feedbacks/my_feedback",
        icon: RefreshCcw,
      },
      {
        label: "Feedback for Movesbook staff",
        href: "/assistance/user_bug_problem",
        icon: Mail,
      },
      {
        label: "Help support info",
        href: "/users/helpSupportFront",
        icon: HelpCircle,
      },
      {
        label: "Send a request to staff",
        href: "/users/sendrequest",
        icon: Mail,
      },
    ],
  },
  {
    id: "community",
    title: "Community contributions",
    items: [
      {
        label: "Review articles",
        href: "/reviews/community_contributions",
        icon: FileText,
      },
      {
        label: "Queries",
        href: "/assistance/user_bug_problem/question",
        icon: HelpCircle,
      },
      {
        label: "Suggestions",
        href: "/assistance/user_bug_problem/suggestion",
        icon: MessageCircle,
      },
      {
        label: "Problems and bugs",
        href: "/assistance/user_bug_problem/problem/0",
        icon: Bug,
      },
    ],
  },
  {
    id: "create",
    title: "Create by yourself",
    items: [
      {
        label: "Create a group",
        href: "#",
        icon: Users,
      },
      {
        label: "Create a fun club",
        href: "#",
        icon: Users,
      },
      {
        label: "Build a promo page",
        href: "#",
        icon: Newspaper,
      },
    ],
  },
  {
    id: "preferences",
    title: "Preferences",
    items: [
      {
        label: "News preferences",
        href: "#",
        icon: Tags,
      },
      {
        label: "Background color",
        href: "/users/background/img",
        icon: Newspaper,
      },
    ],
  },
  {
    id: "documentation",
    title: "Documentation for user",
    items: [
      {
        label: "Terms of use",
        href: "/terms/show/1",
        icon: ClipboardList,
      },
      {
        label: "Privacy policy",
        href: "/terms/show/2",
        icon: Shield,
      },
      {
        label: "Cookies criteria",
        href: "/terms/show/3",
        icon: HelpCircle,
      },
      {
        label: "Guidelines",
        href: "/terms/show/5",
        icon: FileText,
      },
      {
        label: "FAQ",
        href: "#",
        icon: HelpCircle,
      },
    ],
  },
  {
    id: "business",
    title: "Business & Development",
    items: [
      {
        label: "Work with us",
        href: "#",
        icon: Building2,
      },
      {
        label: "Buy an ad space",
        href: "#",
        icon: CreditCard,
      },
      {
        label: "Dealers",
        href: "#",
        icon: ShoppingCart,
      },
      {
        label: "Brands",
        href: "#",
        icon: Tags,
      },
      {
        label: "Developers",
        href: "#",
        icon: Code2,
      },
      {
        label: "API",
        href: "#",
        icon: Puzzle,
      },
    ],
  },
  {
    id: "company",
    title: "Our Company",
    items: [
      {
        label: "About us",
        href: "/Aboutinfos/display",
        icon: Home,
      },
      {
        label: "Support Center",
        href: "#",
        icon: HelpCircle,
      },
      {
        label: "Contact Us",
        href: "#",
        icon: Phone,
      },
    ],
  },
  {
    id: "other",
    title: "Other Links",
    items: [
      {
        label: "Send the list of passwords",
        href: "#",
        icon: Lock,
      },
    ],
  },
];

export default function ProfileDropdownMenu({
  onClose,
  onLogout,
}: ProfileDropdownMenuProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "profile",
  ]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const expandAll = () => {
    setExpandedSections(
      menuSections.map((section) => section.id),
    );
  };

  const collapseAll = () => {
    setExpandedSections([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      transition={{
        type: "spring",
        stiffness: 250,
        damping: 20,
        mass: 0.8,
      }}
      className="flex flex-col h-full max-h-[80vh] overflow-hidden overflow-x-hidden rounded-md border border-slate-300 bg-white shadow-2xl"
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white shrink-0"
      >
        <div>
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-sm font-semibold"
          >
            Quick menu
          </motion.p>

          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22, duration: 0.5 }}
            className="text-xs text-slate-300"
          >
            Account and site options
          </motion.p>
        </div>

        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          whileHover={{
            scale: 1.12,
            rotate: 8,
            transition: { type: "spring", stiffness: 350, damping: 12, mass: 0.6 }
          }}
          whileTap={{ scale: 0.88 }}
          type="button"
          onClick={onClose}
          aria-label="Close profile menu"
          className="rounded p-1.5 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        whileHover={{
          scale: 1.03,
          x: 4,
          transition: { type: "spring", stiffness: 350, damping: 18, mass: 0.7 }
        }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 shrink-0"
      >
        <motion.div
          whileHover={{ rotate: -8 }}
          transition={{ type: "spring", stiffness: 250, damping: 12, mass: 0.6 }}
        >
          <LogOut className="h-4 w-4" />
        </motion.div>
        Logout
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 shrink-0"
      >
        <motion.button
          whileHover={{
            scale: 1.06,
            x: -3,
            transition: { type: "spring", stiffness: 350, damping: 12, mass: 0.6 }
          }}
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={collapseAll}
          className="flex items-center justify-center gap-2 border-r border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          <motion.div
            whileHover={{ rotate: -12 }}
            transition={{ type: "spring", stiffness: 250, damping: 12, mass: 0.6 }}
          >
            <Menu className="h-4 w-4" />
          </motion.div>
          Reduce all
        </motion.button>

        <motion.button
          whileHover={{
            scale: 1.06,
            x: 3,
            transition: { type: "spring", stiffness: 350, damping: 12, mass: 0.6 }
          }}
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={expandAll}
          className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          <motion.div
            whileHover={{ rotate: 12 }}
            transition={{ type: "spring", stiffness: 250, damping: 12, mass: 0.6 }}
          >
            <Menu className="h-4 w-4" />
          </motion.div>
          Expand all
        </motion.button>
      </motion.div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <nav className="h-full">
          <AnimatePresence initial={false}>
            {menuSections.map((section, sectionIndex) => {
              const expanded = expandedSections.includes(
                section.id,
              );

              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.3 + sectionIndex * 0.06,
                    type: "spring",
                    stiffness: 350,
                    damping: 25,
                    mass: 0.7,
                  }}
                  className="border-b border-slate-200"
                >
                  <motion.button
                    whileHover={{
                      backgroundColor: "#5a7ba5",
                      scale: 1.02,
                      transition: { duration: 0.3 }
                    }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between bg-[#7092BE] px-4 py-2.5 text-left text-sm font-semibold text-white"
                  >
                    <motion.span
                      whileHover={{ x: 3 }}
                      transition={{ type: "spring", stiffness: 350, damping: 18, mass: 0.6 }}
                    >
                      {section.title}
                    </motion.span>

                    <motion.div
                      animate={{ rotate: expanded ? 180 : 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 18,
                        mass: 0.6,
                      }}
                    >
                      {expanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </motion.div>
                  </motion.button>

                  <AnimatePresence mode="wait">
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 250,
                          damping: 20,
                          mass: 0.8,
                        }}
                        className="overflow-hidden bg-white"
                      >
                        {section.items.map((item, index) => {
                          const Icon = item.icon;

                          return (
                            <motion.div
                              key={`${section.id}-${item.label}`}
                              initial={{ opacity: 0, y: -8, x: -8 }}
                              animate={{ opacity: 1, y: 0, x: 0 }}
                              exit={{ opacity: 0, y: -8, x: -8 }}
                              transition={{
                                type: "spring",
                                stiffness: 350,
                                damping: 22,
                                mass: 0.7,
                                delay: index * 0.03,
                              }}
                              whileHover={{
                                x: 4,
                                scale: 1.008,
                                transition: { type: "spring", stiffness: 450, damping: 18, mass: 0.5 }
                              }}
                            >
                              <Link
                                href={item.href}
                                onClick={() => {
                                  if (item.href !== "#") {
                                    onClose?.();
                                  }
                                }}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                              >
                                <motion.div
                                  whileHover={{ rotate: 8 }}
                                  transition={{ type: "spring", stiffness: 250, damping: 12, mass: 0.6 }}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                </motion.div>
                                <span className="break-words overflow-hidden text-ellipsis">{item.label}</span>
                              </Link>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              );
            })}
          </AnimatePresence>
        </nav>
      </div>
    </motion.div>
  );
}