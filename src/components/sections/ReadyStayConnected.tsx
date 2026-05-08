"use client";
import { motion } from "framer-motion";
import { useI18n } from "@/components/providers/I18nProvider";
import  FadeIn  from "@/components/animations/FadeIn";


export default function ReadyStayConnected() {
  const { t } = useI18n();
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <motion.div 
            className="bg-orange-50 border border-orange-200 rounded-3xl p-12"
            whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <h2 className="text-4xl font-bold text-slate-800 mb-4">
                  {t("cta.title")}
                </h2>
                <p className="text-slate-600 text-lg mb-8 max-w-xl mx-auto">
                  {t("cta.subtitle")}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <motion.a
                    href="#plans"
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-400 text-white font-semibold px-10 py-4 rounded-xl text-lg transition-colors shadow-xl shadow-orange-900/20"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {t("common.findYourPlan")}
                  </motion.a>
                  <motion.a
                    href="#how-it-works"
                    className="w-full sm:w-auto px-10 py-4 rounded-xl text-lg font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {t("common.learnMore")}
                  </motion.a>
                </div>
              </motion.div>
            </FadeIn>
          </div>
        </section>
    );
}