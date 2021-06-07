import { SchemaEditor } from "@theguild/editor";
import React from "react";

export const Editor: React.FC<{
  schema: string;
}> = ({ schema }) => {
  return <SchemaEditor height={"100vh"} theme={"vs-dark"} schema={schema} />;
};
