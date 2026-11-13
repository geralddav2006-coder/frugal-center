"use client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" className="w-full"><LogOut /> Sign out</Button>
    </form>
  );
}
