import * as React from "react";
import {
  Input,
  InputGroup,
  InputRightElement,
  Button,
  useToast,
} from "@chakra-ui/react";

export const CopyInput = (props: React.ComponentProps<typeof Input>) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  return (
    <InputGroup size="md">
      <Input pr="4.5rem" variant="filled" ref={inputRef} {...props} />
      <InputRightElement width="4.5rem">
        <Button
          h="1.75rem"
          size="sm"
          onClick={() => {
            inputRef.current?.select();
            document.execCommand("copy");
            toast({
              isClosable: true,
              position: "bottom",
              title: "Link was copied to clipboard",
              status: "info",
            });
          }}
        >
          Copy
        </Button>
      </InputRightElement>
    </InputGroup>
  );
};
