import type { Metadata } from "next";
import { requireOrg } from "@/lib/org";
import type { Announcement } from "@/lib/types";
import { AnnouncementsClient } from "./announcements-client";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const { supabase } = await requireOrg();

  const [announcementsRes, unitsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("units").select("id", { count: "exact", head: true }),
  ]);

  return (
    <AnnouncementsClient
      announcements={(announcementsRes.data ?? []) as Announcement[]}
      memberCount={unitsRes.count ?? 0}
    />
  );
}
