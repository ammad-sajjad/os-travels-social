export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const name = process.env.NEXT_PUBLIC_APP_NAME || "Social Autopilot";
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-6 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Privacy Policy — {name}</h1>
      <p>{name} is a private tool used by the business that owns it to create and publish posts on its own Facebook Page and Instagram account. It is not offered to the public.</p>
      <h2 className="font-semibold text-slate-900">What we access</h2>
      <p>Using Meta&apos;s Graph API, the tool reads basic details of the business&apos;s own Facebook Page and Instagram professional account and publishes posts, reels and comments that the business owner creates or approves. It may read engagement statistics for those posts.</p>
      <h2 className="font-semibold text-slate-900">What we store</h2>
      <p>Post text, images and videos created in the tool, publishing results (post IDs and links) and brand settings. We do not collect or store personal data of Facebook or Instagram users, and we do not sell or share any data.</p>
      <h2 className="font-semibold text-slate-900">Data deletion</h2>
      <p>To delete data, the business owner can delete posts in the tool, remove the app in Meta Business Settings, or contact the business through its Facebook Page; all stored data will be deleted on request.</p>
    </main>
  );
}
