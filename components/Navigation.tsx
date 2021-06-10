import * as React from "react";
import Link from "next/link";
import "twin.macro";
import { Logo } from "./Logo";

export interface NavigationItem {
  label: string;
  link: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface State {
  organization?: string;
  project?: string;
  target?: string;
  menuTitle?: string;
  menu?: NavigationItem[];
}

const NavigationContext = React.createContext<{
  organization?: string;
  project?: string;
  target?: string;
  menuTitle?: string;
  menu?: NavigationItem[];
  visible?: boolean;
  setNavigation: (state: State) => void;
  show(): void;
  hide(): void;
}>({
  organization: undefined,
  project: undefined,
  target: undefined,
  menuTitle: undefined,
  menu: undefined,
  visible: false,
  setNavigation: () => {},
  show() {},
  hide() {},
});

export const useNavigation = () => React.useContext(NavigationContext);

export const NavigationProvider: React.FC = ({ children }) => {
  const [state, setState] = React.useState<State>({});
  const [visible, setVisible] = React.useState<boolean>(true);
  const show = React.useCallback(() => setVisible(true), [setVisible]);
  const hide = React.useCallback(() => setVisible(false), [setVisible]);
  const setNavigation = React.useCallback(
    (state: State) => {
      setState(state);
      show();
    },
    [show, setState]
  );

  return (
    <NavigationContext.Provider
      value={{
        organization: state.organization,
        project: state.project,
        target: state.target,
        menu: state.menu,
        menuTitle: state.menuTitle,
        visible,
        setNavigation,
        show,
        hide,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function Navigation() {
  return (
    <nav tw="bg-black shadow-md z-10">
      <div tw="mx-auto px-2 sm:px-6 lg:px-8">
        <div tw="relative flex flex-row items-center justify-between h-12">
          <div tw="flex-1 flex items-center justify-center sm:items-stretch sm:justify-center">
            <Link href="/" passHref>
              <a tw="flex-shrink-0 flex text-yellow-500 items-center hover:opacity-50">
                <Logo tw="w-6 h-6" />
              </a>
            </Link>
          </div>
          <div tw="inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:mr-6 sm:pr-0"></div>
        </div>
      </div>
    </nav>
  );
}
