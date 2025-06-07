import { Route, Routes, useLocation } from "react-router-dom";
import {AnimatePresence} from 'framer-motion'

export default function Content({ routes }) {
    const location = useLocation();
    return (
        <AnimatePresence>
            <Routes location={location} key={location.pathname}>
                {routes.map(route => (
                    <Route key={route.path} path={route.path} element={route.element} />
                ))}
            </Routes>
        </AnimatePresence>
    )
}