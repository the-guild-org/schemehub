import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";
import { SchemaEditor } from "@theguild/editor";

export default function Home() {
  return <SchemaEditor height={"100vh"} theme={"vs-dark"} schema={``} />;
}
