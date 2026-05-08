import SupportClient from "./supportClient";
import { Metadata } from "next";


export const metadata: Metadata = {
  title: "Support | OpenWorldeSIM",
  description: "Get help with your eSIM purchase and activation",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <SupportClient />
    </div>
  );
}