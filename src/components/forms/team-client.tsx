"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { AddUserForm } from "./team-forms";

export function TeamClient() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ নতুন ইউজার</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="নতুন ইউজার যোগ">
        <AddUserForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
