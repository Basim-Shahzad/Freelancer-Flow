import { useState, useEffect } from "react";
import { useApi } from "../Contexts/Api";

export function useClients() {
   const { api } = useApi();
   const [ clients, setClients ] = useState([]);
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);

   async function fetchClients() {
      try {
         setLoading(true);
         const res = await api.get("/clients/");
         setClients(res.data.clients);
      } catch (err) {
         setError(err);
      } finally {
         setLoading(false);
      }
   }

   return { clients, fetchClients, error, loading };
}
