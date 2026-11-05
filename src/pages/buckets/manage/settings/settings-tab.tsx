import WebsiteAccessSection from "./website-section";
import AliasesSection from "./aliases-section";
import QuotaSection from "./quota-section";
import DangerZone from "./danger-zone";

/** Aliases, website access and quotas, then the danger zone. Every section saves by itself. */
const SettingsTab = () => (
  <div className="grid gap-4">
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <AliasesSection />
        <WebsiteAccessSection />
      </div>
      <QuotaSection />
    </div>
    <DangerZone />
  </div>
);

export default SettingsTab;
