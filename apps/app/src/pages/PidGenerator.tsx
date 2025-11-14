import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@prossmind/shared/config";
import AppLayout from "@/components/AppLayout";
import DiagramGenerator from "@/components/DiagramGenerator";

const PidGenerator = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <DiagramGenerator user={user} diagramType="pid" />
      </div>
    </AppLayout>
  );
};

export default PidGenerator;




