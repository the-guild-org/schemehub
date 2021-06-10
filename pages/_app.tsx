import "regenerator-runtime/runtime";
import "../styles/globals.css";
import { AppProps, Container } from "next/app";
import { ChakraProvider, DarkMode, extendTheme } from "@chakra-ui/react";
import { colors } from "../lib/theme";
import GlobalStylesComponent from "../lib/GlobalStyles";

const theme = extendTheme({
  colors,
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
  },
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <GlobalStylesComponent />
      <ChakraProvider theme={theme}>
        <DarkMode>
          <Container>
            <Component {...pageProps} />
          </Container>
        </DarkMode>
      </ChakraProvider>
    </>
  );
}

export default MyApp;
