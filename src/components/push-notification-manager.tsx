"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/ui";
import {
  getPushPublicKeyAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/app/actions/notifications";

type State = "checking" | "unsupported" | "disabled" | "enabled" | "denied" | "busy";

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

function subscriptionInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("ব্রাউজারের subscription তথ্য সম্পূর্ণ নয়");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) throw new Error("অ্যাপটি আগে হোম স্ক্রিনে ইনস্টল করুন, তারপর আবার চেষ্টা করুন");
  return registration;
}

export function PushNotificationManager() {
  const [state, setState] = React.useState<State>("checking");

  React.useEffect(() => {
    let active = true;
    async function check() {
      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!active) return;
      if (!subscription) {
        setState("disabled");
        return;
      }

      // Re-associate an existing browser subscription with the currently logged-in user.
      const saved = await savePushSubscriptionAction(subscriptionInput(subscription));
      setState(saved.ok ? "enabled" : "disabled");
    }
    check().catch(() => active && setState("unsupported"));
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }

      const [registration, keyResult] = await Promise.all([getRegistration(), getPushPublicKeyAction()]);
      if (!keyResult.ok) throw new Error(keyResult.error);

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(keyResult.data.publicKey),
        }));

      const saved = await savePushSubscriptionAction(subscriptionInput(subscription));
      if (!saved.ok) {
        if (!existing) await subscription.unsubscribe();
        throw new Error(saved.error);
      }

      setState("enabled");
      toast.success("এই ডিভাইসে নোটিফিকেশন চালু হয়েছে");
    } catch (error) {
      setState("disabled");
      toast.error((error as Error).message || "নোটিফিকেশন চালু করা যায়নি");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const removed = await removePushSubscriptionAction(subscription.endpoint);
        if (!removed.ok) throw new Error(removed.error);
        await subscription.unsubscribe();
      }
      setState("disabled");
      toast.success("এই ডিভাইসে নোটিফিকেশন বন্ধ হয়েছে");
    } catch (error) {
      setState("enabled");
      toast.error((error as Error).message || "নোটিফিকেশন বন্ধ করা যায়নি");
    }
  }

  const enabled = state === "enabled";

  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">🔔 ফোনে পুশ নোটিফিকেশন</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            নতুন টাস্ক, অর্ডার, পেমেন্ট, খরচ বা গুরুত্বপূর্ণ আপডেট হলে অ্যাপ বন্ধ থাকলেও ফোনে জানাবে।
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {enabled ? "চালু" : "বন্ধ"}
        </span>
      </div>

      <div className="mt-3">
        {state === "checking" || state === "busy" ? (
          <Button variant="secondary" disabled>
            <Spinner /> পরীক্ষা হচ্ছে…
          </Button>
        ) : enabled ? (
          <Button variant="secondary" onClick={disable}>
            এই ডিভাইসে বন্ধ করুন
          </Button>
        ) : state === "denied" ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
            ব্রাউজারে নোটিফিকেশন Block করা আছে। ফোনের Settings → Site settings → Notifications থেকে Allow করুন।
          </p>
        ) : state === "unsupported" ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
            আগে অ্যাপটি হোম স্ক্রিনে ইনস্টল করুন। iPhone-এ Safari → Share → Add to Home Screen ব্যবহার করতে হবে।
          </p>
        ) : (
          <Button onClick={enable}>🔔 এই ডিভাইসে নোটিফিকেশন চালু করুন</Button>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">প্রত্যেক ব্যবহারকারীকে নিজের ফোনে একবার এই অনুমতি দিতে হবে।</p>
    </div>
  );
}
