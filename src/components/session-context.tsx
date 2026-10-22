import { createContext, useContext } from "react";

export const SessionEmailContext = createContext<string | null>(null);
export const useSessionEmail = () => useContext(SessionEmailContext);