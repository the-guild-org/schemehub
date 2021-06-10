import tw from "twin.macro";
import { Navigation } from "./Navigation";

export const PageContainer = tw.div`flex flex-col flex-1 overflow-y-auto relative`;

const WithNavigation: React.FC<{}> = ({ children }) => {
  return (
    <PageContainer>
      <Navigation />
      {children}
    </PageContainer>
  );
};

export const Page: React.FC<{}> = ({ children }) => {
  return <WithNavigation>{children}</WithNavigation>;
};
