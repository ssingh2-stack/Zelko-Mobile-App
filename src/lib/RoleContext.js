import React, { createContext, useContext } from "react";

const RoleContext = createContext({ role: "admin", staffBarberId: null });

export const RoleProvider = RoleContext.Provider;
export function useRole() { return useContext(RoleContext); }
