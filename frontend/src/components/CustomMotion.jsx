import { motion } from 'framer-motion'

export default function CustomMotion(props) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.75 }}
            {...props}>
            {props.children}
        </motion.div>
    )
}