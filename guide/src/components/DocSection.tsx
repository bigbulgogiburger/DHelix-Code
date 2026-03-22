interface DocSectionProps {
  id: string;
  icon: string;
  title: string;
  children: React.ReactNode;
}

export function DocSection({ id, icon, title, children }: DocSectionProps) {
  return (
    <section id={id} style={{ marginBottom: "64px" }}>
      <h2
        className="text-2xl font-bold text-gray-900"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
          marginTop: "0",
        }}
      >
        <span>{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}
