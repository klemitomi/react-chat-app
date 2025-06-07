import CustomMotion from "./CustomMotion";

export default function Loading(props) {
    return (
        <CustomMotion>
            <div className="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
        </CustomMotion>
    )
}